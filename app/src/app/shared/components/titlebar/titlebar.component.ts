import { Component, inject, signal } from '@angular/core';
import { PlatformService } from '../../../core/services/platform.service';

@Component({
  selector: 'app-titlebar',
  standalone: true,
  template: `
    @if (platform.isDesktop) {
      <div class="desktop-titlebar">
        <img src="assets/dawini-icon.svg" class="titlebar-icon" alt="" />
        <span class="titlebar-title">Dawini Desktop</span>

        <div class="titlebar-controls">
          <button (click)="platform.minimize()" title="Réduire">
            <i class="bi bi-dash-lg"></i>
          </button>
          <button (click)="platform.maximize()" title="Agrandir">
            <i [class]="isMaximized() ? 'bi bi-copy' : 'bi bi-square'"></i>
          </button>
          <button (click)="platform.close()" class="close-btn" title="Fermer">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>
    }
  `,
})
export class TitlebarComponent {
  readonly platform = inject(PlatformService);
  readonly isMaximized = signal(false);

  constructor() {
    this.platform.isMaximized().then((m) => this.isMaximized.set(m));
    this.platform.onMaximizedChange((m) => this.isMaximized.set(m));
  }
}
