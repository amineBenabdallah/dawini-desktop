import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h5 class="mb-0 fw-semibold text-dark">{{ title() }}</h5>
        @if (subtitle()) {
          <p class="text-muted small mb-0 mt-1">{{ subtitle() }}</p>
        }
      </div>
      @if (actionLabel()) {
        <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" (click)="action.emit()">
          <i class="bi bi-plus-lg"></i>
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title     = input.required<string>();
  readonly subtitle  = input<string>('');
  readonly actionLabel = input<string>('');
  readonly action    = output<void>();
}
