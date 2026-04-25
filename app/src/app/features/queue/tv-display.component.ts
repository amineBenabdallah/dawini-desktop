import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { environment } from '../../../environments/environment';

interface QueueEvent {
  tokenId: string;
  position: number;
  status: string;
}

/**
 * TV display board — fullscreen, dark, large fonts.
 * Designed to run on a secondary monitor in the waiting room.
 * Shows current patient being called and the next in queue.
 */
@Component({
  selector: 'app-tv-display',
  standalone: true,
  template: `
    <div class="tv-display">
      <div class="tv-header">
        <h1 class="tv-title">File d'attente</h1>
        <span class="tv-time">{{ currentTime() }}</span>
      </div>

      <div class="tv-content">
        <div class="tv-current">
          <div class="tv-label">EN COURS</div>
          <div class="tv-number" [class.pulse]="currentCalled()">
            @if (currentCalled()) {
              N&deg; {{ currentCalled() }}
            } @else {
              --
            }
          </div>
        </div>

        <div class="tv-next">
          <div class="tv-label">SUIVANT</div>
          <div class="tv-queue">
            @for (item of waitingList(); track item.tokenId) {
              <div class="tv-queue-item">
                N&deg; {{ item.position }}
              </div>
            } @empty {
              <div class="tv-empty">Aucun patient en attente</div>
            }
          </div>
        </div>
      </div>

      <div class="tv-footer">
        <span>Dawini &mdash; Cabinet M&eacute;dical</span>
      </div>
    </div>
  `,
  styles: [`
    .tv-display {
      width: 100vw;
      height: 100vh;
      background: linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      color: white;
      display: flex;
      flex-direction: column;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      user-select: none;
      cursor: none;
    }

    .tv-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 30px 50px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .tv-title {
      font-size: 32px;
      font-weight: 700;
      background: linear-gradient(135deg, #60a5fa, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .tv-time {
      font-size: 28px;
      color: rgba(255, 255, 255, 0.5);
      font-variant-numeric: tabular-nums;
    }

    .tv-content {
      flex: 1;
      display: flex;
      gap: 40px;
      padding: 40px 50px;
    }

    .tv-current {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-right: 1px solid rgba(255, 255, 255, 0.06);
    }

    .tv-label {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 3px;
      color: rgba(255, 255, 255, 0.4);
      margin-bottom: 20px;
    }

    .tv-number {
      font-size: 120px;
      font-weight: 800;
      color: #3b82f6;
      text-shadow: 0 0 60px rgba(59, 130, 246, 0.3);
      line-height: 1;
    }

    .tv-number.pulse {
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.85; transform: scale(1.03); }
    }

    .tv-next {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 20px;
    }

    .tv-queue {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      max-width: 300px;
    }

    .tv-queue-item {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px 24px;
      font-size: 36px;
      font-weight: 600;
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
    }

    .tv-empty {
      color: rgba(255, 255, 255, 0.3);
      font-size: 20px;
      text-align: center;
      padding: 40px;
    }

    .tv-footer {
      padding: 20px 50px;
      text-align: center;
      color: rgba(255, 255, 255, 0.15);
      font-size: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
  `],
})
export class TvDisplayComponent implements OnInit, OnDestroy {
  currentTime = signal('');
  currentCalled = signal<number | null>(null);
  waitingList = signal<QueueEvent[]>([]);
  private eventSource: EventSource | null = null;
  private timeInterval: any;

  ngOnInit() {
    this.updateTime();
    this.timeInterval = setInterval(() => this.updateTime(), 1000);
    this.connectSSE();
  }

  ngOnDestroy() {
    clearInterval(this.timeInterval);
    this.eventSource?.close();
  }

  private updateTime() {
    this.currentTime.set(
      new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    );
  }

  private connectSSE() {
    const url = `${environment.apiUrl}/queue/display/stream`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      const data: QueueEvent = JSON.parse(event.data);

      if (data.status === 'CALLED' || data.status === 'CALLED_MANUAL') {
        this.currentCalled.set(data.position);
      }

      // Update waiting list
      this.waitingList.update((list) => {
        const filtered = list.filter((t) => t.tokenId !== data.tokenId);
        if (data.status === 'WAITING') {
          filtered.push(data);
          filtered.sort((a, b) => a.position - b.position);
        }
        return filtered.slice(0, 6); // Show max 6
      });
    };

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      setTimeout(() => this.connectSSE(), 5000); // Reconnect
    };
  }
}
