import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * AmiraService — Frontend API client for Dr. Amira AI assistant.
 *
 * Two query modes:
 *   query()  → POST /ai/query  → JSON response (always works)
 *   stream() → POST /ai/stream → SSE token-by-token (only when LLM loaded)
 *
 * The panel calls query() first. If LLM is loaded, it can optionally
 * use stream() for progressive rendering.
 */

export interface AmiraToken {
  token: string;
  done: boolean;
  sources?: { source: string; page: number }[];
  error?: boolean;
}

export interface AmiraStatus {
  loaded: boolean;
  modelName: string | null;
  ramUsageMb: number;
  error: string | null;
}

export interface AmiraResponse {
  text: string;
  sources: { source: string; page: number }[];
  fromReferences: boolean;
}

@Injectable({ providedIn: 'root' })
export class AmiraService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /**
   * Standard query — JSON response via HttpClient.
   * Always works (returns error message if LLM not loaded).
   */
  query(screen: string, question: string, ids?: { patientId?: string; consultationId?: string }): Observable<AmiraResponse> {
    return this.http.post<AmiraResponse>(`${this.api}/ai/query`, {
      screen, question, ...ids,
    });
  }

  /**
   * Streaming query — SSE token-by-token via fetch.
   * Only useful when LLM is loaded and generating long responses.
   */
  stream(screen: string, question: string, ids?: { patientId?: string; consultationId?: string }): Observable<AmiraToken> {
    const subject = new Subject<AmiraToken>();
    const body = { screen, question, ...ids };

    fetch(`${this.api}/ai/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
      },
      body: JSON.stringify(body),
    }).then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Erreur Amira' }));
        subject.next({ token: err.message || 'Erreur Amira.', done: true, error: true });
        subject.complete();
        return;
      }

      const text = await response.text();
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: AmiraToken = JSON.parse(line.slice(6));
            subject.next(event);
            if (event.done) break;
          } catch {}
        }
      }

      subject.complete();
    }).catch(() => {
      subject.next({ token: 'Impossible de contacter Amira.', done: true, error: true });
      subject.complete();
    });

    return subject.asObservable();
  }

  /** Check vital signs — fast whisper response. */
  checkVitals(vitals: { ta?: string; poids?: number; temp?: number }, patientId?: string): Observable<{ alert: string | null }> {
    return this.http.post<{ alert: string | null }>(`${this.api}/ai/vitals`, {
      ...vitals, patientId,
    });
  }

  /** Get Amira status (is model loaded?). */
  getStatus(): Observable<AmiraStatus> {
    return this.http.get<AmiraStatus>(`${this.api}/ai/status`);
  }

  /** Index a document. */
  indexDocument(filePath: string, category?: string): Observable<{ chunksIndexed: number; fileName: string }> {
    return this.http.post<{ chunksIndexed: number; fileName: string }>(`${this.api}/ai/index`, {
      filePath, category,
    });
  }

  /** Get library stats. */
  getLibrary(): Observable<{ totalChunks: number }> {
    return this.http.get<{ totalChunks: number }>(`${this.api}/ai/library`);
  }

  /** Remove an indexed document. */
  removeDocument(source: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/ai/library/${encodeURIComponent(source)}`);
  }
}
