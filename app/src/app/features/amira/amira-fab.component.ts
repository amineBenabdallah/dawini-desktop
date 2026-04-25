import { Component, inject, signal, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AmiraService } from '../../core/services/amira.service';

/**
 * Floating Action Button — bottom-right, always visible.
 * States: idle, thinking (pulse), has suggestion (red dot).
 * Click → emits toggle event. Ctrl+Space global shortcut.
 * Hidden on: login, setup, print routes.
 */
@Component({
  selector: 'app-amira-fab',
  standalone: true,
  template: `
    @if (visible()) {
      <button class="amira-fab" [class.thinking]="thinking()" (click)="toggle.emit()"
              [title]="'Dr. Amira — Ctrl+Space'">
        <span class="amira-fab__letter">A</span>
        @if (hasSuggestion()) {
          <span class="amira-fab__badge"></span>
        }
      </button>
    }
  `,
  styles: [`
    .amira-fab {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white;
      border: none;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;

      &:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
      }

      &:active {
        transform: scale(0.95);
      }

      &.thinking {
        animation: amiraFabPulse 2s ease-in-out infinite;
      }
    }

    .amira-fab__letter {
      font-weight: 700;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    }

    .amira-fab__badge {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      background: #ef4444;
      border-radius: 50%;
      border: 2px solid white;
      animation: badgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes amiraFabPulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08), 0 4px 14px rgba(37, 99, 235, 0.3); }
      50%      { box-shadow: 0 0 0 12px rgba(37, 99, 235, 0.03), 0 4px 14px rgba(37, 99, 235, 0.3); }
    }

    @keyframes badgePop {
      from { transform: scale(0); }
      to   { transform: scale(1); }
    }
  `],
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class AmiraFabComponent implements OnInit, OnDestroy {
  @Output() toggle = new EventEmitter<void>();

  private router = inject(Router);
  private amira = inject(AmiraService);
  private sub?: Subscription;

  visible = signal(true);
  thinking = signal(false);
  hasSuggestion = signal(false);

  private hiddenRoutes = ['/login', '/setup', '/print'];

  ngOnInit() {
    this.sub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    ).subscribe((e) => {
      this.visible.set(!this.hiddenRoutes.some((r) => e.url.startsWith(r)));
    });

    // Check initial route
    this.visible.set(!this.hiddenRoutes.some((r) => this.router.url.startsWith(r)));
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.code === 'Space') {
      event.preventDefault();
      this.toggle.emit();
    }
  }

  setThinking(value: boolean) { this.thinking.set(value); }
  setSuggestion(value: boolean) { this.hasSuggestion.set(value); }
}
