import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface LigneOrdonnance {
  id: string;
  ordonnanceId: string;
  medicament: string;
  dosage: string;
  frequence: string;
  duree: string;
  instructions: string | null;
}

export interface Ordonnance {
  id: string;
  tenantId: string;
  consultationId: string;
  patientId: string;
  docteurId: string;
  dateEmission: string;
  numero: string;
  statut: 'ACTIVE' | 'ANNULEE';
  createdAt: string;
  updatedAt: string;
  patient?: { firstName: string; lastName: string };
  lignesCount?: number;
}

export interface OrdonnanceWithLignes extends Ordonnance {
  lignes?: LigneOrdonnance[];
}

export interface OrdonnanceListResponse {
  data: Ordonnance[];
  total: number;
  page: number;
  limit: number;
}

export interface ListOrdonnancesQuery {
  patientId?: string;
  consultationId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateLigneDto {
  medicament: string;
  dosage: string;
  frequence: string;
  duree: string;
  instructions?: string;
}

export interface CreateOrdonnanceDto {
  consultationId: string;
  lignes: CreateLigneDto[];
}

export interface UpdateOrdonnanceDto {
  lignes: CreateLigneDto[];
}

export interface PrintData {
  numero: string;
  createdAt: string;
  patient: { firstName: string; lastName: string; dateNaissance?: string };
  docteur: { firstName: string; lastName: string; specialite?: string };
  medicaments: { nom: string; posologie: string; duree?: string }[];
  instructions?: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OrdonnanceService {
  private readonly api = inject(ApiService);

  list(query: ListOrdonnancesQuery = {}): Observable<OrdonnanceListResponse> {
    return this.api.get<OrdonnanceListResponse>('ordonnances', query as Record<string, string | number | boolean>);
  }

  getById(id: string): Observable<OrdonnanceWithLignes> {
    return this.api.get<OrdonnanceWithLignes>(`ordonnances/${id}`);
  }

  create(dto: CreateOrdonnanceDto): Observable<OrdonnanceWithLignes> {
    return this.api.post<OrdonnanceWithLignes>('ordonnances', dto);
  }

  update(id: string, dto: UpdateOrdonnanceDto): Observable<OrdonnanceWithLignes> {
    return this.api.patch<OrdonnanceWithLignes>(`ordonnances/${id}`, dto);
  }

  annuler(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`ordonnances/${id}`);
  }

  getPrintData(id: string): Observable<PrintData> {
    return this.api.get<PrintData>(`ordonnances/${id}/print`);
  }
}
