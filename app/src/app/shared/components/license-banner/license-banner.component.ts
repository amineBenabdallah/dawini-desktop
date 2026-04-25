import { Component, inject, signal, OnInit } from '@angular/core';
import { PlatformService } from '../../../core/services/platform.service';

@Component({
  selector: 'app-license-banner',
  standalone: true,
  template: `
    @if (showBanner()) {
      <div class="license-banner" [class]="bannerClass()">
        <i class="bi" [class]="iconClass()"></i>
        <span>{{ message() }}</span>
      </div>
    }
  `,
  styles: [`
    .license-banner {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 6px 16px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;

      &.expired, &.revoked {
        background: linear-gradient(135deg, #ef4444, #dc2626);
      }
      &.pending {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
      }
    }
  `],
})
export class LicenseBannerComponent implements OnInit {
  private platform = inject(PlatformService);
  showBanner = signal(false);
  bannerClass = signal('');
  iconClass = signal('bi-hourglass-split');
  message = signal('');

  async ngOnInit() {
    if (!this.platform.isDesktop) return;

    const status = await this.platform.getLicenseStatus();

    switch (status.state) {
      case 'trial':
        this.showBanner.set(true);
        this.iconClass.set('bi-hourglass-split');
        this.message.set(`P\u00e9riode d'essai : ${status.daysLeft} jour(s) restant(s)`);
        break;
      case 'pending':
        this.showBanner.set(true);
        this.bannerClass.set('pending');
        this.iconClass.set('bi-clock-history');
        this.message.set('Licence en attente de validation par le fournisseur');
        break;
      case 'expired':
        this.showBanner.set(true);
        this.bannerClass.set('expired');
        this.iconClass.set('bi-exclamation-triangle');
        this.message.set('Licence expir\u00e9e. Contactez votre fournisseur.');
        break;
      case 'revoked':
        this.showBanner.set(true);
        this.bannerClass.set('revoked');
        this.iconClass.set('bi-x-circle');
        this.message.set('Licence d\u00e9sactiv\u00e9e. Contactez votre fournisseur.');
        break;
      // 'active' → no banner
    }
  }
}
