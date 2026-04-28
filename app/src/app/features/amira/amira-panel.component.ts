import { Component, Input, Output, EventEmitter, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AmiraService } from '../../core/services/amira.service';
import { AuthService } from '../../core/services/auth.service';
import { AmiraWelcomeComponent } from './amira-welcome.component';

/**
 * Talk panel — slide-out conversation with Dr. Amira.
 * 380px wide, slides from right.
 * SSE streaming renders tokens progressively.
 */

interface ChatMessage {
  role: 'doctor' | 'amira';
  text: string;
  sources?: { source: string; page: number }[];
  streaming?: boolean;
}

@Component({
  selector: 'app-amira-panel',
  standalone: true,
  imports: [FormsModule, AmiraWelcomeComponent],
  template: `
    @if (open) {
      <div class="amira-panel" (keydown.escape)="close.emit()">
        <!-- Header -->
        <div class="ap-header">
          <div class="ap-avatar">A</div>
          <div class="ap-info">
            <div class="ap-name">Dr. Amira</div>
            <div class="ap-status">
              @if (isStreaming()) {
                <span class="ap-status-dot thinking"></span> R&eacute;flexion...
              } @else {
                <span class="ap-status-dot online"></span> En ligne
              }
            </div>
          </div>
          <button class="ap-close" (click)="close.emit()">&times;</button>
        </div>

        <!-- Context bar -->
        @if (contextLabel) {
          <div class="ap-context">📋 {{ contextLabel }}</div>
        }

        <!-- Messages -->
        <div class="ap-messages" #messagesContainer>
          @if (messages().length === 0) {
            <div class="ap-empty">
              <div class="ap-empty-avatar">A</div>
              <p>Bonjour ! Pose-moi une question ou utilise les boutons rapides ci-dessous.</p>
              @if (!amiraReady()) {
                <div class="ap-reload-block">
                  <p>Mod&egrave;le IA non charg&eacute;.</p>
                  <button class="ap-reload-btn" (click)="retryModel()" [disabled]="isRetrying()">
                    {{ isRetrying() ? 'V&eacute;rification...' : 'R&eacute;essayer' }}
                  </button>
                </div>
              }
            </div>
          }

          @for (msg of messages(); track $index) {
            <div class="ap-msg" [class]="'ap-msg--' + msg.role">
              <div class="ap-msg__text">{{ msg.text }}{{ msg.streaming ? '▊' : '' }}</div>
              @if (msg.sources?.length) {
                <div class="ap-msg__sources">
                  @for (src of msg.sources; track src.source) {
                    <span class="ap-source-badge">{{ src.source }} p.{{ src.page }}</span>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Quick actions -->
        <div class="ap-quick">
          <button (click)="quickAction('Suggère un diagnostic')">Diagnostic</button>
          <button (click)="quickAction('R\u00e9dige une ordonnance')">Ordonnance</button>
          <button (click)="quickAction('R\u00e9dige un certificat')">Certificat</button>
          <button (click)="quickAction('R\u00e9sume le dossier patient')">R&eacute;sum&eacute;</button>
        </div>

        <!-- Input -->
        <div class="ap-input">
          <input type="text" [(ngModel)]="inputText" placeholder="Demander &agrave; Amira..."
                 (keydown.enter)="send()" [disabled]="isStreaming()" />
          <button (click)="send()" [disabled]="isStreaming() || !inputText.trim()">&#x27A4;</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .amira-panel {
      position: fixed;
      top: 36px; /* titlebar height */
      right: 0;
      bottom: 0;
      width: 380px;
      background: rgba(255, 255, 255, 0.97);
      backdrop-filter: blur(20px);
      border-left: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      z-index: 500;
      animation: panelSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.04);
    }

    @keyframes panelSlideIn {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0); opacity: 1; }
    }

    /* Header */
    .ap-header {
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ap-avatar {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700;
    }
    .ap-info { flex: 1; }
    .ap-name { font-size: 14px; font-weight: 600; color: #0f172a; }
    .ap-status { font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 4px; }
    .ap-status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      &.online { background: #10b981; }
      &.thinking { background: #2563eb; animation: dotPulse 1s infinite; }
    }
    @keyframes dotPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .ap-close {
      border: none; background: none; color: #94a3b8;
      font-size: 20px; cursor: pointer; padding: 0;
      &:hover { color: #475569; }
    }

    /* Context bar */
    .ap-context {
      padding: 8px 18px;
      background: #f8fafc;
      border-bottom: 1px solid #f1f5f9;
      font-size: 11px;
      color: #64748b;
    }

    /* Messages */
    .ap-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      &::-webkit-scrollbar { width: 3px; }
      &::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 3px; }
    }

    .ap-empty {
      text-align: center;
      padding: 40px 20px;
      color: #94a3b8;
      font-size: 13px;
    }

    .ap-reload-block {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      p { font-size: 12px; color: #94a3b8; margin: 0; }
    }
    .ap-reload-btn {
      padding: 6px 18px;
      border-radius: 20px;
      border: 1.5px solid #2563eb;
      background: white;
      color: #2563eb;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.12s;
      &:hover:not(:disabled) { background: #2563eb; color: white; }
      &:disabled { opacity: 0.5; cursor: default; }
    }
    .ap-empty-avatar {
      width: 48px; height: 48px; border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white; font-size: 20px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 12px;
    }

    .ap-msg {
      max-width: 88%;
      animation: msgIn 0.2s ease;
    }
    @keyframes msgIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

    .ap-msg--doctor {
      align-self: flex-end;
      .ap-msg__text {
        background: #eff6ff;
        color: #1e40af;
        padding: 10px 14px;
        border-radius: 14px 14px 4px 14px;
        font-size: 13px;
        line-height: 1.5;
      }
    }

    .ap-msg--amira {
      align-self: flex-start;
      .ap-msg__text {
        background: white;
        border: 1px solid #e2e8f0;
        color: #334155;
        padding: 10px 14px;
        border-radius: 14px 14px 14px 4px;
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
      }
    }

    .ap-msg__sources {
      margin-top: 4px;
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .ap-source-badge {
      font-size: 10px;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 10px;
    }

    /* Quick actions */
    .ap-quick {
      padding: 8px 18px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;

      button {
        padding: 4px 10px;
        border-radius: 20px;
        border: 1px solid #e2e8f0;
        background: white;
        font-size: 11px;
        color: #64748b;
        cursor: pointer;
        transition: all 0.12s;

        &:hover {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }
      }
    }

    /* Input */
    .ap-input {
      padding: 12px 18px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      gap: 8px;

      input {
        flex: 1;
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        outline: none;
        &:focus { border-color: #2563eb; }
        &:disabled { background: #f8fafc; }
      }

      button {
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 10px;
        padding: 8px 14px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.12s;
        &:hover:not(:disabled) { background: #1d4ed8; }
        &:disabled { opacity: 0.4; }
      }
    }
  `],
})
export class AmiraPanelComponent implements AfterViewChecked {
  @Input() open = false;
  @Input() screen = 'chat';
  @Input() patientId?: string;
  @Input() consultationId?: string;
  @Input() contextLabel = '';
  @Output() close = new EventEmitter<void>();

  @ViewChild('messagesContainer') messagesEl?: ElementRef<HTMLDivElement>;

  private amira = inject(AmiraService);
  private auth = inject(AuthService);

  messages = signal<ChatMessage[]>([]);
  isStreaming = signal(false);
  amiraReady = signal(false);
  isRetrying = signal(false);
  inputText = '';
  private shouldScroll = false;
  private statusChecked = false;

  ngAfterViewChecked() {
    if (this.shouldScroll && this.messagesEl) {
      this.messagesEl.nativeElement.scrollTop = this.messagesEl.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
    // Check Amira status once when panel opens
    if (this.open && !this.statusChecked) {
      this.statusChecked = true;
      this.amira.getStatus().subscribe({
        next: (s) => this.amiraReady.set(s.loaded),
        error: () => this.amiraReady.set(false),
      });
    }
  }

  retryModel() {
    if (this.isRetrying()) return;
    this.isRetrying.set(true);
    this.amira.reload().subscribe({
      next: (s) => {
        this.amiraReady.set(s.loaded);
        this.isRetrying.set(false);
      },
      error: () => this.isRetrying.set(false),
    });
  }

  send() {
    const text = this.inputText.trim();
    if (!text || this.isStreaming()) return;
    this.inputText = '';
    this.doQuery(text);
  }

  quickAction(question: string) {
    if (this.isStreaming()) return;
    this.doQuery(question);
  }

  private doQuery(question: string) {
    this.messages.update((m) => [...m, { role: 'doctor', text: question }]);
    this.messages.update((m) => [...m, { role: 'amira', text: '...', streaming: true }]);
    this.isStreaming.set(true);
    this.shouldScroll = true;

    this.amira.query(this.screen, question, {
      patientId: this.patientId,
      consultationId: this.consultationId,
    }).subscribe({
      next: (res) => {
        this.messages.update((msgs) => {
          const last = msgs[msgs.length - 1];
          if (last?.role === 'amira') {
            return [...msgs.slice(0, -1), { role: 'amira', text: res.text, streaming: false, sources: res.sources }];
          }
          return msgs;
        });
        this.isStreaming.set(false);
        this.shouldScroll = true;
      },
      error: (err) => {
        const errorMsg = err.error?.message || 'Amira n\'est pas disponible. Aucun mod\u00e8le IA charg\u00e9.';
        this.messages.update((msgs) => {
          const last = msgs[msgs.length - 1];
          if (last?.role === 'amira') {
            return [...msgs.slice(0, -1), { role: 'amira', text: errorMsg, streaming: false }];
          }
          return msgs;
        });
        this.isStreaming.set(false);
        this.shouldScroll = true;
      },
    });
  }
}
