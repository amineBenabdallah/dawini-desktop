import { Component, inject, signal } from '@angular/core';
import { PlatformService } from '../../../core/services/platform.service';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  template: `
    @if (updateAvailable()) {
      <div class="update-banner">
        <i class="bi bi-arrow-repeat"></i>
        <span>Mise à jour v{{ updateVersion() }} disponible</span>
        @if (downloaded()) {
          <button class="btn btn-sm btn-light" (click)="install()">
            Redémarrer
          </button>
        } @else {
          <button class="btn btn-sm btn-light" (click)="platform.installUpdate()">
            Télécharger
          </button>
        }
        <button class="btn-dismiss" (click)="dismiss()">&times;</button>
      </div>
    }
  `,
  styles: [`
    .update-banner {
      background: linear-gradient(135deg, var(--dw-primary), var(--dw-accent));
      color: white;
      padding: 8px 16px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;

      .btn-dismiss {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        margin-left: auto;
        opacity: 0.7;
        &:hover { opacity: 1; }
      }
    }
  `],
})
export class UpdateBannerComponent {
  readonly platform = inject(PlatformService);
  readonly updateAvailable = signal(false);
  readonly updateVersion = signal('');
  readonly downloaded = signal(false);

  constructor() {
    this.platform.onUpdateAvailable((info) => {
      this.updateAvailable.set(true);
      this.updateVersion.set(info.version);
    });

    this.platform.onUpdateDownloaded((info) => {
      this.downloaded.set(true);
      this.updateVersion.set(info.version);
    });

    // Trigger a fresh check now that the renderer is mounted and listening.
    // The startup check in initAutoUpdater() may have fired before this
    // component subscribed, so its update-available event would have been
    // lost. Re-checking from here guarantees we receive it.
    if (this.platform.isDesktop) {
      setTimeout(() => {
        const api = (window as any).electronAPI;
        if (api?.checkForUpdates) {
          api.checkForUpdates().catch(() => {});
        }
      }, 1500);
    }
  }

  install(): void {
    this.platform.installUpdate();
  }

  dismiss(): void {
    this.updateAvailable.set(false);
  }
}
