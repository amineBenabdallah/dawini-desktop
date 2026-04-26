import { Injectable, signal } from '@angular/core';
import { AmiraSuggestion } from '../../features/amira/amira-suggest.component';

@Injectable({ providedIn: 'root' })
export class AmiraNotifyService {
  readonly cards = signal<AmiraSuggestion[]>([]);
  private counter = 0;

  show(suggestion: Omit<AmiraSuggestion, 'id'>): number {
    const id = ++this.counter;
    this.cards.update((c) => {
      const next = [...c, { ...suggestion, id }];
      return next.slice(-2);
    });
    setTimeout(() => this.dismiss(id), 15000);
    return id;
  }

  dismiss(id: number): void {
    this.cards.update((c) => c.filter((card) => card.id !== id));
  }

  clear(): void {
    this.cards.set([]);
  }
}
