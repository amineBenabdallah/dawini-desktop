import { Component, inject, signal, OnInit } from '@angular/core';
import { AmiraService } from '../../core/services/amira.service';
import { PlatformService } from '../../core/services/platform.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Library manager — drag-drop PDFs, view indexed documents.
 * Embedded in Settings page under "Dr. Amira" tab.
 */
@Component({
  selector: 'app-amira-library',
  standalone: true,
  template: `
    <div class="al-section">
      <h6 class="fw-bold mb-3">Biblioth&egrave;que Dr. Amira</h6>

      <!-- Drop zone -->
      <div class="al-dropzone"
           [class.active]="dragging()"
           (dragover)="onDragOver($event)"
           (dragleave)="dragging.set(false)"
           (drop)="onDrop($event)">
        <i class="bi bi-cloud-arrow-up" style="font-size:24px;color:#94a3b8"></i>
        <p>Glissez vos PDFs ici</p>
        <span class="al-formats">PDF, DOCX, TXT — max 100 MB</span>
        <button class="btn btn-sm btn-outline-primary mt-2" (click)="pickFile()">Parcourir</button>
      </div>

      <!-- Indexing progress -->
      @if (indexing()) {
        <div class="al-progress mt-3">
          <div class="d-flex justify-content-between mb-1">
            <span class="al-progress-label">Indexation: {{ indexingFile() }}</span>
            <span class="al-progress-label">{{ indexingPercent() }}%</span>
          </div>
          <div class="progress" style="height:4px;border-radius:4px">
            <div class="progress-bar" [style.width.%]="indexingPercent()" style="background:#2563eb"></div>
          </div>
        </div>
      }

      <!-- Stats -->
      <div class="al-stats mt-3">
        <span>{{ totalChunks() }} fragments index&eacute;s</span>
      </div>
    </div>
  `,
  styles: [`
    .al-dropzone {
      border: 2px dashed #e2e8f0;
      border-radius: 14px;
      padding: 32px;
      text-align: center;
      transition: all 0.2s;
      cursor: pointer;

      &.active { border-color: #2563eb; background: rgba(37, 99, 235, 0.02); }
      &:hover { border-color: #cbd5e1; }

      p { font-size: 13px; color: #64748b; margin: 8px 0 0; }
      .al-formats { font-size: 11px; color: #94a3b8; }
    }

    .al-progress-label { font-size: 12px; color: #64748b; }
    .al-stats { font-size: 12px; color: #94a3b8; }
  `],
})
export class AmiraLibraryComponent implements OnInit {
  private amira = inject(AmiraService);
  private platform = inject(PlatformService);
  private toast = inject(ToastService);

  dragging = signal(false);
  indexing = signal(false);
  indexingFile = signal('');
  indexingPercent = signal(0);
  totalChunks = signal(0);

  ngOnInit() {
    this.loadStats();
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(true);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);

    const files = e.dataTransfer?.files;
    if (files?.length) {
      // In Electron, we can get the path from the File object
      const file = files[0];
      const filePath = (file as any).path;
      if (filePath) {
        this.indexFile(filePath);
      }
    }
  }

  async pickFile() {
    if (!this.platform.isDesktop) return;

    const result = await (window as any).electronAPI?.openFile([
      { name: 'Documents', extensions: ['pdf', 'docx', 'txt'] },
    ]);

    if (result?.path) {
      this.indexFile(result.path);
    }
  }

  private indexFile(filePath: string) {
    this.indexing.set(true);
    this.indexingFile.set(filePath.split(/[/\\]/).pop() || '');
    this.indexingPercent.set(0);

    this.amira.indexDocument(filePath).subscribe({
      next: (res) => {
        this.indexing.set(false);
        this.indexingPercent.set(100);
        this.toast.success(`${res.fileName}: ${res.chunksIndexed} fragments indexés`);
        this.loadStats();
      },
      error: (err) => {
        this.indexing.set(false);
        this.toast.error(err.error?.message || 'Erreur lors de l\'indexation');
      },
    });
  }

  private loadStats() {
    this.amira.getLibrary().subscribe({
      next: (res) => this.totalChunks.set(res.totalChunks),
      error: () => {},
    });
  }
}
