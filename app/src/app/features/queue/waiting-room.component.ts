import {
  Component, OnInit, OnDestroy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type Step = 'join' | 'waiting' | 'called' | 'done';

interface SseEvent {
  tokenId: string;
  position: number;
  status: string;
}

interface TokenStatus {
  status: string;
  position: number;
  patientName: string;
}

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waiting-room.component.html',
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http  = inject(HttpClient);

  readonly step        = signal<Step>('join');
  readonly submitting  = signal(false);
  readonly position    = signal<number>(0);
  readonly tokenId     = signal<string | null>(null);
  readonly patientName = signal('');
  readonly pushGranted = signal(false);
  readonly error       = signal<string | null>(null);

  tenantId  = '';
  nameInput = '';

  private eventSource?: EventSource;

  readonly positionLabel = computed(() => {
    const p = this.position();
    if (p === 0) return 'Vous êtes le prochain';
    if (p === 1) return '1 personne avant vous';
    return `${p} personnes avant vous`;
  });

  ngOnInit() {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') ?? '';
    this.primeNotificationPermission();
    this.restoreFromStorage();
  }

  ngOnDestroy() {
    this.eventSource?.close();
  }

  // ── localStorage helpers ─────────────────────────────────────────────────

  private storageKey(): string {
    return `queue-token-${this.tenantId}`;
  }

  private saveToStorage(tokenId: string, name: string): void {
    localStorage.setItem(this.storageKey(), JSON.stringify({ tokenId, patientName: name }));
  }

  private clearStorage(): void {
    localStorage.removeItem(this.storageKey());
  }

  private restoreFromStorage(): void {
    const raw = localStorage.getItem(this.storageKey());
    if (!raw) return;

    let saved: { tokenId: string; patientName: string };
    try { saved = JSON.parse(raw) as { tokenId: string; patientName: string }; }
    catch { this.clearStorage(); return; }

    this.http.get<TokenStatus | null>(`/api/queue/${saved.tokenId}/status`).subscribe({
      next: (res) => {
        if (!res || res.status === 'DONE' || res.status === 'ABSENT') {
          this.clearStorage();
          return;
        }
        this.tokenId.set(saved.tokenId);
        this.patientName.set(res.patientName || saved.patientName);
        this.position.set(res.position >= 0 ? res.position : 0);

        if (res.status === 'CALLED' || res.status === 'CALLED_MANUAL') {
          this.step.set('called');
          this.notifyPatient();
        } else {
          // WAITING — reopen SSE stream and push subscription
          this.step.set('waiting');
          this.openSse(saved.tokenId);
          this.requestPushPermission(saved.tokenId);
        }
      },
      error: () => this.clearStorage(),
    });
  }

  // ── Join ─────────────────────────────────────────────────────────────────

  join() {
    if (!this.nameInput.trim() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.http.post<{ tokenId: string; estimatedPosition: number }>(
      '/api/queue/join',
      { tenantId: this.tenantId, patientName: this.nameInput.trim() },
    ).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.tokenId.set(res.tokenId);
        this.patientName.set(this.nameInput.trim());
        this.position.set(res.estimatedPosition);
        this.step.set('waiting');
        this.saveToStorage(res.tokenId, this.nameInput.trim());
        this.openSse(res.tokenId);
        this.requestPushPermission(res.tokenId);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? 'Impossible de rejoindre la file. Réessayez.');
      },
    });
  }

  // ── SSE ──────────────────────────────────────────────────────────────────

  private openSse(tokenId: string) {
    this.eventSource = new EventSource(`/api/queue/${tokenId}/stream`);

    this.eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SseEvent;
        this.position.set(data.position);

        if (data.status === 'CALLED' || data.status === 'CALLED_MANUAL') {
          this.step.set('called');
          this.notifyPatient();
          this.eventSource?.close();
        } else if (data.status === 'DONE' || data.status === 'ABSENT') {
          this.step.set('done');
          this.clearStorage();
          this.eventSource?.close();
        }
      } catch { /* ignore parse errors */ }
    };

    this.eventSource.onerror = () => { /* SSE reconnects automatically */ };
  }

  // ── Notify (vibrate + beep) ───────────────────────────────────────────────

  private notifyPatient(): void {
    // Vibrate pattern: long-short-long
    if ('vibrate' in navigator) {
      navigator.vibrate([400, 100, 400, 100, 400]);
    }
    // Audible beep via Web Audio API
    try {
      const ctx = new AudioContext();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.05);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.35);
      gain.gain.linearRampToValueAtTime(0, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.5);
      osc.onended = () => ctx.close();
    } catch { /* AudioContext blocked or unsupported */ }
  }

  // ── Push permission ───────────────────────────────────────────────────────

  private async primeNotificationPermission() {
    if (!('Notification' in window) || Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    await Notification.requestPermission().catch(() => {/* ignore */});
  }

  private async requestPushPermission(tokenId: string) {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const { publicKey } = await this.http
        .get<{ publicKey: string }>('/api/queue/vapid-public-key')
        .toPromise() as { publicKey: string };

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
      });

      const device = this.detectDevice();

      await this.http.post(
        `/api/queue/${tokenId}/subscribe`,
        { pushSubscription: subscription.toJSON(), deviceHint: device },
      ).toPromise();

      this.pushGranted.set(true);
    } catch {
      // Push setup failed — SSE fallback is already active
    }
  }

  private detectDevice(): 'ANDROID' | 'IOS' | 'UNKNOWN' {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'ANDROID';
    if (/iphone|ipad|ipod/i.test(ua)) return 'IOS';
    return 'UNKNOWN';
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from({ length: raw.length }, (_, i) => raw.charCodeAt(i));
  }
}
