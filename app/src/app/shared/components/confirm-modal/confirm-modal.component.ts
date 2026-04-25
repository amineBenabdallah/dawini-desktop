import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.35);z-index:9999" (click)="cancel.emit()">
        <div class="modal-dialog modal-dialog-centered" (click)="$event.stopPropagation()">
          <div class="modal-content border-0 shadow-sm rounded-3">
            <div class="modal-header border-0 pb-0">
              <h6 class="modal-title fw-semibold">{{ title() }}</h6>
              <button type="button" class="btn-close" (click)="cancel.emit()"></button>
            </div>
            <div class="modal-body text-muted small">{{ message() }}</div>
            <div class="modal-footer border-0 pt-0 gap-2">
              <button class="btn btn-sm btn-outline-secondary" (click)="cancel.emit()">Annuler</button>
              <button class="btn btn-sm btn-{{ confirmVariant() }}" (click)="confirm.emit()">
                <i class="bi {{ confirmIcon() }} me-1"></i>{{ confirmLabel() }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmModalComponent {
  readonly visible        = input(false);
  readonly title          = input('Confirmer');
  readonly message        = input('Êtes-vous sûr de vouloir continuer ?');
  readonly confirmLabel   = input('Supprimer');
  readonly confirmVariant = input('danger');
  readonly confirmIcon    = input('bi-trash');
  readonly confirm        = output<void>();
  readonly cancel         = output<void>();
}
