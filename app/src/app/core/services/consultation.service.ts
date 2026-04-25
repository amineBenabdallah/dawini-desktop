import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ConsultationStatus } from '@shared/index';

export { ConsultationStatus };

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ConsultationPatient {
  firstName: string;
  lastName: string;
}

export interface Consultation {
  id: string;
  tenantId: string;
  patientId: string;
  docteurId: string;
  rendezVousId: string | null;
  dateConsultation: string;
  motif: string;
  examenClinique: string | null;
  diagnostic: string | null;
  traitement: string | null;
  notes: string | null;
  tensionArterielle: string | null;
  poids: number | null;
  temperature: number | null;
  statut: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
  patient: ConsultationPatient;
}

export interface ConsultationAttachment {
  id: string;
  consultationId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  path: string;
  createdAt: string;
}

export interface ConsultationDetail extends Consultation {
  attachments?: ConsultationAttachment[];
}

export interface ConsultationListResponse {
  data: Consultation[];
  total: number;
  page: number;
  limit: number;
}

export interface ListConsultationsQuery {
  patientId?: string;
  docteurId?: string;
  dateFrom?: string;
  dateTo?: string;
  statut?: ConsultationStatus;
  page?: number;
  limit?: number;
}

export interface CreateConsultationDto {
  patientId: string;
  docteurId: string;
  rendezVousId?: string;
  dateConsultation?: string;
  motif: string;
  examenClinique?: string;
  diagnostic?: string;
  traitement?: string;
  notes?: string;
  tensionArterielle?: string;
  poids?: number;
  temperature?: number;
}

export interface UpdateConsultationDto {
  dateConsultation?: string;
  motif?: string;
  examenClinique?: string | null;
  diagnostic?: string | null;
  traitement?: string | null;
  notes?: string | null;
  tensionArterielle?: string | null;
  poids?: number | null;
  temperature?: number | null;
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ConsultationService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  list(query: ListConsultationsQuery = {}): Observable<ConsultationListResponse> {
    return this.api.get<ConsultationListResponse>('consultations', query as Record<string, string | number | boolean>);
  }

  getById(id: string): Observable<ConsultationDetail> {
    return this.api.get<ConsultationDetail>(`consultations/${id}`);
  }

  create(dto: CreateConsultationDto): Observable<Consultation> {
    return this.api.post<Consultation>('consultations', dto);
  }

  update(id: string, dto: UpdateConsultationDto): Observable<Consultation> {
    return this.api.patch<Consultation>(`consultations/${id}`, dto);
  }

  start(id: string): Observable<Consultation> {
    return this.api.post<Consultation>(`consultations/${id}/start`, {});
  }

  finalize(id: string): Observable<Consultation> {
    return this.api.post<Consultation>(`consultations/${id}/finalize`, {});
  }

  uploadAttachment(consultationId: string, file: File): Observable<ConsultationAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ConsultationAttachment>(`/api/consultations/${consultationId}/attachments`, formData);
  }
}
