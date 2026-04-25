import { Component, Output, EventEmitter } from '@angular/core';

/**
 * Welcome screen — shown on first launch when no model is loaded.
 */
@Component({
  selector: 'app-amira-welcome',
  standalone: true,
  template: `
    <div class="amira-welcome">
      <div class="aw-avatar">A</div>
      <h3>Bonjour, je suis Amira</h3>
      <p>Votre cons&oelig;ur num&eacute;rique. Je travaille uniquement &agrave; partir de vos r&eacute;f&eacute;rences m&eacute;dicales.</p>
      <p class="aw-detail">Ajoutez vos PDFs (Dorosz, Vidal, guides MSPRH...) dans la biblioth&egrave;que pour que je puisse vous assister.</p>
      <div class="aw-actions">
        <button class="aw-btn primary" (click)="openLibrary.emit()">Ouvrir la biblioth&egrave;que</button>
        <button class="aw-btn ghost" (click)="dismiss.emit()">Plus tard</button>
      </div>
    </div>
  `,
  styles: [`
    .amira-welcome {
      text-align: center;
      padding: 40px 24px;
      max-width: 400px;
      margin: 0 auto;
    }
    .aw-avatar {
      width: 64px; height: 64px; border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white; font-size: 28px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    h3 { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    p { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0; }
    .aw-detail { font-size: 13px; color: #94a3b8; margin-top: 12px; }
    .aw-actions { display: flex; gap: 10px; justify-content: center; margin-top: 24px; }
    .aw-btn {
      padding: 10px 24px; border-radius: 10px; font-size: 14px;
      font-weight: 500; cursor: pointer; border: none; transition: all 0.15s;
      &.primary { background: #2563eb; color: white; box-shadow: 0 2px 8px rgba(37,99,235,0.2); }
      &.primary:hover { box-shadow: 0 4px 16px rgba(37,99,235,0.3); }
      &.ghost { background: #f1f5f9; color: #475569; }
      &.ghost:hover { background: #e2e8f0; }
    }
  `],
})
export class AmiraWelcomeComponent {
  @Output() openLibrary = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();
}
