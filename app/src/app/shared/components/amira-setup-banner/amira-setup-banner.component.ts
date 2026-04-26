import { Component, inject, signal } from '@angular/core';
import { PlatformService } from '../../../core/services/platform.service';

@Component({
  selector: 'app-amira-setup-banner',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="amira-setup-banner" [class.error]="phase() === 'error'">
        <i class="bi" [class.bi-stars]="phase() !== 'error'" [class.bi-exclamation-triangle]="phase() === 'error'"></i>
        <div class="banner-content">
          <span class="banner-message">{{ message() }}</span>
          @if (phase() !== 'error' && phase() !== 'idle' && phase() !== 'ready') {
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="percent()"></div>
            </div>
          }
        </div>
        @if (phase() === 'error') {
          <button class="btn btn-sm btn-light" (click)="retry()">Réessayer</button>
        }
        <button class="btn-dismiss" (click)="dismiss()">&times;</button>
      </div>
    }
  `,
  styles: [`
    .amira-setup-banner {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      padding: 10px 16px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 12px;

      &.error {
        background: linear-gradient(135deg, #dc2626, #ef4444);
      }

      .banner-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .banner-message {
        font-weight: 500;
      }

      .progress-bar {
        height: 4px;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 2px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: white;
        transition: width 0.3s ease;
      }

      .btn-dismiss {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        opacity: 0.7;
        &:hover { opacity: 1; }
      }
    }
  `],
})
export class AmiraSetupBannerComponent {
  readonly platform = inject(PlatformService);
  readonly visible = signal(false);
  readonly phase = signal<string>('idle');
  readonly percent = signal(0);
  readonly message = signal('');
  readonly dismissed = signal(false);

  constructor() {
    if (!this.platform.isDesktop) return;

    this.platform.onAmiraSetupProgress((p) => {
      this.phase.set(p.phase);
      this.percent.set(p.percent || 0);
      this.message.set(p.error ? `${p.message}: ${p.error}` : p.message);

      if (p.phase === 'idle' || p.phase === 'checking') {
        this.visible.set(false);
        return;
      }

      if (p.phase === 'ready') {
        this.visible.set(true);
        setTimeout(() => this.visible.set(false), 4000);
        return;
      }

      if (!this.dismissed()) {
        this.visible.set(true);
      }
    });

    this.platform.amiraSetupStatus().then((p) => {
      if (p && p.phase !== 'idle') {
        this.phase.set(p.phase);
        this.percent.set(p.percent || 0);
        this.message.set(p.message || '');
        if (p.phase !== 'ready' && p.phase !== 'checking') {
          this.visible.set(true);
        }
      }
    });
  }

  retry(): void {
    this.dismissed.set(false);
    this.platform.amiraSetupRun();
  }

  dismiss(): void {
    this.visible.set(false);
    this.dismissed.set(true);
  }
}
