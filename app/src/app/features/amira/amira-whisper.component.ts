import { Component, Input, signal, inject, OnChanges, SimpleChanges } from '@angular/core';
import { AmiraService } from '../../core/services/amira.service';

/**
 * Whisper — tiny inline hint below a form field.
 * Appears 500ms after value changes. Dismissible.
 * Used in consultation (vitals, motif) and patient file.
 */
@Component({
  selector: 'app-amira-whisper',
  standalone: true,
  template: `
    @if (text() && !dismissed()) {
      <div class="amira-whisper" [class]="severity()">
        <span class="amira-whisper__icon">{{ icon() }}</span>
        <span class="amira-whisper__text">{{ text() }}</span>
        <button class="amira-whisper__close" (click)="dismiss()">&times;</button>
      </div>
    }
  `,
  styles: [`
    .amira-whisper {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(37, 99, 235, 0.04);
      animation: whisperIn 0.35s ease 0.5s both;

      &.danger  { color: #dc2626; background: rgba(239, 68, 68, 0.04); }
      &.warning { color: #b45309; background: rgba(245, 158, 11, 0.04); }
      &.info    { color: #2563eb; background: rgba(37, 99, 235, 0.04); }
    }

    .amira-whisper__icon { font-size: 11px; flex-shrink: 0; }
    .amira-whisper__text { flex: 1; line-height: 1.4; }
    .amira-whisper__close {
      border: none;
      background: none;
      color: inherit;
      opacity: 0.4;
      cursor: pointer;
      font-size: 14px;
      padding: 0 2px;
      line-height: 1;
      &:hover { opacity: 0.8; }
    }

    @keyframes whisperIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class AmiraWhisperComponent implements OnChanges {
  /** The field value to analyze (e.g., "16/10" for TA) */
  @Input() value = '';
  /** Type of check: 'vitals-ta' | 'vitals-temp' | 'vitals-poids' | 'motif' */
  @Input() check = '';
  /** Patient ID for context */
  @Input() patientId?: string;

  private amira = inject(AmiraService);
  private debounceTimer: any;

  text = signal('');
  severity = signal<'info' | 'warning' | 'danger'>('info');
  icon = signal('💡');
  dismissed = signal(false);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] && this.value) {
      this.dismissed.set(false);
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.analyze(), 500);
    }
  }

  dismiss() {
    this.dismissed.set(true);
  }

  private analyze() {
    if (!this.value?.trim()) return;

    if (this.check.startsWith('vitals')) {
      this.analyzeVitals();
    } else if (this.check === 'motif') {
      this.analyzeMotif();
    }
  }

  private analyzeVitals() {
    // Quick local check first (no LLM needed)
    if (this.check === 'vitals-ta') {
      const parts = this.value.split('/').map(Number);
      if (parts.length === 2) {
        const [sys, dia] = parts;
        if (sys >= 180 || dia >= 110) {
          this.showAlert('HTA grade 3 — urgence hypertensive', 'danger');
        } else if (sys >= 160 || dia >= 100) {
          this.showAlert('HTA grade 2 — considérer ajustement thérapeutique', 'warning');
        } else if (sys >= 140 || dia >= 90) {
          this.showAlert('HTA grade 1', 'warning');
        } else if (sys < 90 || dia < 60) {
          this.showAlert('Hypotension', 'danger');
        } else {
          this.text.set('');
        }
      }
    } else if (this.check === 'vitals-temp') {
      const temp = parseFloat(this.value);
      if (temp >= 40) this.showAlert(`Hyperthermie sévère (${temp}°C)`, 'danger');
      else if (temp >= 38.5) this.showAlert(`Fièvre (${temp}°C)`, 'warning');
      else if (temp < 35) this.showAlert(`Hypothermie (${temp}°C)`, 'danger');
      else this.text.set('');
    }
  }

  private analyzeMotif() {
    // Ask Amira for a quick differential suggestion
    this.amira.query('consultation', `Motif: "${this.value}". Suggère en une phrase les diagnostics à évoquer.`, {
      patientId: this.patientId,
    }).subscribe({
      next: (res: any) => {
        if (res.text && res.fromReferences) {
          this.showAlert(res.text, 'info');
        }
      },
      error: () => {}, // Silent — whisper is non-critical
    });
  }

  private showAlert(message: string, sev: 'info' | 'warning' | 'danger') {
    this.text.set(message);
    this.severity.set(sev);
    this.icon.set(sev === 'danger' ? '⚠️' : sev === 'warning' ? '↗' : '💡');
  }
}
