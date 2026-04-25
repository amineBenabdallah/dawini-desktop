import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _counter = 0;
  readonly toasts = signal<Toast[]>([]);

  success(message: string) { this.add(message, 'success'); }
  error(message: string)   { this.add(message, 'error'); }
  warning(message: string) { this.add(message, 'warning'); }
  info(message: string)    { this.add(message, 'info'); }

  remove(id: number) {
    this.toasts.update(ts => ts.filter(t => t.id !== id));
  }

  private add(message: string, type: ToastType) {
    const id = ++this._counter;
    this.toasts.update(ts => [...ts, { id, message, type }]);
    setTimeout(() => this.remove(id), 4000);
  }
}
