import { Component, inject } from '@angular/core';
import { AmiraNotifyService } from '../../core/services/amira-notify.service';

/**
 * Suggest — floating action card, bottom-right above FAB.
 * Slides in when Amira has something important (drug interaction, diagnostic).
 * Auto-dismisses after 15s. Max 2 stacked.
 */

export interface AmiraSuggestion {
  id: number;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'danger';
  source?: string;
  actions?: { label: string; key: string; primary?: boolean }[];
}

@Component({
  selector: 'app-amira-suggest',
  standalone: true,
  template: `
    <div class="amira-suggest-container">
      @for (card of cards(); track card.id) {
        <div class="amira-suggest-card" [class]="card.severity">
          <div class="asc-header">
            <div class="asc-avatar">A</div>
            <span class="asc-name">Dr. Amira</span>
            <button class="asc-close" (click)="dismiss(card.id)">&times;</button>
          </div>
          <div class="asc-body" [innerHTML]="card.body"></div>
          @if (card.actions?.length) {
            <div class="asc-actions">
              @for (action of card.actions; track action.key) {
                <button [class]="action.primary ? 'asc-btn primary' : 'asc-btn ghost'"
                        (click)="onAction(card.id, action.key)">
                  {{ action.label }}
                </button>
              }
            </div>
          }
          @if (card.source) {
            <div class="asc-source">📄 {{ card.source }}</div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .amira-suggest-container {
      position: fixed;
      bottom: 80px;
      right: 20px;
      z-index: 999;
      display: flex;
      flex-direction: column-reverse;
      gap: 10px;
      max-width: 340px;
    }

    .amira-suggest-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #2563eb;
      border-radius: 0 14px 14px 0;
      padding: 14px 18px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
      animation: suggestSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);

      &.danger  { border-left-color: #ef4444; }
      &.warning { border-left-color: #f59e0b; }
    }

    .asc-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .asc-avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }

    .asc-name {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      flex: 1;
    }

    .asc-close {
      border: none;
      background: none;
      color: #94a3b8;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      &:hover { color: #475569; }
    }

    .asc-body {
      font-size: 13px;
      color: #334155;
      line-height: 1.6;
      margin-bottom: 10px;

      :host ::ng-deep strong { color: #0f172a; }
    }

    .asc-actions {
      display: flex;
      gap: 6px;
      margin-bottom: 6px;
    }

    .asc-btn {
      padding: 5px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: all 0.12s;

      &.primary {
        background: #2563eb;
        color: white;
        &:hover { background: #1d4ed8; }
      }

      &.ghost {
        background: #f1f5f9;
        color: #475569;
        &:hover { background: #e2e8f0; }
      }
    }

    .asc-source {
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    @keyframes suggestSlideIn {
      from { opacity: 0; transform: translateX(20px) scale(0.95); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }
  `],
})
export class AmiraSuggestComponent {
  private readonly notify = inject(AmiraNotifyService);
  readonly cards = this.notify.cards;

  dismiss(id: number) {
    this.notify.dismiss(id);
  }

  onAction(cardId: number, _actionKey: string) {
    this.notify.dismiss(cardId);
  }
}
