import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CertificatType } from '@shared/index';

export { CertificatType };

export const TYPE_LABELS: Record<string, string> = {
  REPOS: 'Repos médical',
  APTITUDE: 'Aptitude',
  INAPTITUDE: 'Inaptitude',
  SCOLAIRE: 'Scolaire',
};

export interface Certificat {
  id: string;
  tenantId: string;
  consultationId: string;
  patientId: string;
  docteurId: string;
  type: string;
  numero: string;
  contenu: string;
  joursRepos: number | null;
  dateEmission: string;
  statut: 'ACTIVE' | 'ANNULEE';
  createdAt: string;
  updatedAt: string;
  patient?: { firstName: string; lastName: string };
}

export interface CertificatListResponse {
  data: Certificat[];
  total: number;
  page: number;
  limit: number;
}

export interface ListCertificatsQuery {
  patientId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateCertificatDto {
  consultationId: string;
  type: string;
  contenu: string;
  joursRepos?: number;
}

export interface UpdateCertificatDto {
  type?: string;
  contenu?: string;
  joursRepos?: number;
}

export interface PrintData {
  numero: string;
  type: string;
  createdAt: string;
  content: string;
  patient: { firstName: string; lastName: string; dateNaissance?: string };
  docteur: { firstName: string; lastName: string; specialite?: string };
  joursRepos?: number;
}

@Injectable({ providedIn: 'root' })
export class CertificatService {
  private readonly api = inject(ApiService);

  list(query: ListCertificatsQuery = {}): Observable<CertificatListResponse> {
    return this.api.get<CertificatListResponse>('certificats', query as Record<string, string | number | boolean>);
  }

  getById(id: string): Observable<Certificat> {
    return this.api.get<Certificat>(`certificats/${id}`);
  }

  create(dto: CreateCertificatDto): Observable<Certificat> {
    return this.api.post<Certificat>('certificats', dto);
  }

  update(id: string, dto: UpdateCertificatDto): Observable<Certificat> {
    return this.api.patch<Certificat>(`certificats/${id}`, dto);
  }

  annuler(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`certificats/${id}`);
  }

  getPrintData(id: string): Observable<PrintData> {
    return this.api.get<PrintData>(`certificats/${id}/print`);
  }
}
