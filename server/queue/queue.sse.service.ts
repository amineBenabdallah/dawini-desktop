import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface QueueEvent {
  cabinetId: string;
  tokenId: string;
  position: number;
  status: string;
}

/**
 * SSE service for real-time queue position updates.
 * Desktop edition — no Web Push, pure SSE over WiFi LAN.
 */
@Injectable()
export class QueueSseService {
  private subject = new Subject<QueueEvent>();

  /** Emit a position update for a specific token */
  emit(event: QueueEvent): void {
    this.subject.next(event);
  }

  /** Broadcast a cabinet-wide update (e.g., "next patient called") */
  broadcast(cabinetId: string, tokens: { tokenId: string; position: number; status: string }[]): void {
    for (const t of tokens) {
      this.subject.next({ cabinetId, ...t });
    }
  }

  /** Subscribe to position updates for a specific token */
  subscribe(tokenId: string): Observable<MessageEvent> {
    return this.subject.pipe(
      filter((e) => e.tokenId === tokenId),
      map(
        (e) =>
          ({
            data: JSON.stringify({ position: e.position, status: e.status }),
          }) as MessageEvent,
      ),
    );
  }

  /** Subscribe to ALL events for a cabinet (for TV display) */
  subscribeAll(cabinetId: string): Observable<MessageEvent> {
    return this.subject.pipe(
      filter((e) => e.cabinetId === cabinetId),
      map(
        (e) =>
          ({
            data: JSON.stringify({
              tokenId: e.tokenId,
              position: e.position,
              status: e.status,
            }),
          }) as MessageEvent,
      ),
    );
  }
}
