import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index:1100">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast show align-items-center border-0 mb-2 text-bg-{{ toastClass(toast.type) }}"
          role="alert"
        >
          <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2">
              <i class="bi {{ toastIcon(toast.type) }}"></i>
              {{ toast.message }}
            </div>
            <button
              type="button"
              class="btn-close btn-close-white me-2 m-auto"
              (click)="toastService.remove(toast.id)"
            ></button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  toastClass(type: string): string {
    return { success: 'success', error: 'danger', warning: 'warning', info: 'primary' }[type] ?? 'secondary';
  }

  toastIcon(type: string): string {
    return { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' }[type] ?? 'bi-bell';
  }
}
