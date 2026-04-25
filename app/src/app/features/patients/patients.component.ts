import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  wilaya?: string;
  commune?: string;
  nss?: string;
  patientNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, LoadingSpinnerComponent, UpperCasePipe],
  templateUrl: './patients.component.html',
})
export class PatientsComponent implements OnInit {
  private readonly api   = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly patients    = signal<Patient[]>([]);
  readonly total       = signal(0);
  readonly page        = signal(1);
  readonly loading     = signal(true);
  readonly showModal   = signal(false);
  readonly saving      = signal(false);
  readonly showOptional = signal(false);
  readonly selectedPatient = signal<Patient | null>(null);
  readonly showDetailModal = signal(false);
  readonly detailLoading = signal(false);

  search = '';
  readonly today = new Date().toISOString().slice(0, 10);

  form = {
    firstName: '', lastName: '', phone: '',
    dateOfBirth: '', gender: '' as 'M' | 'F' | '',
    email: '', wilaya: '', commune: '', nss: '',
  };

  get canSave(): boolean {
    return !!this.form.firstName.trim() &&
           !!this.form.lastName.trim() &&
           !!this.form.phone.trim() &&
           !!this.form.dateOfBirth &&
           !!this.form.gender;
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.get<{ data: Patient[]; total: number }>('patients', {
      q: this.search, page: this.page(), limit: 20,
    }).subscribe({
      next: (res) => { this.patients.set(res.data ?? []); this.total.set(res.total ?? 0); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openModal() {
    this.form = { firstName: '', lastName: '', phone: '', dateOfBirth: '', gender: '', email: '', wilaya: '', commune: '', nss: '' };
    this.showOptional.set(false);
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.canSave || this.saving()) return;
    this.saving.set(true);
    this.api.post<Patient>('patients', {
      firstName:   this.form.firstName.trim(),
      lastName:    this.form.lastName.trim(),
      phone:       this.form.phone.trim(),
      dateOfBirth: this.form.dateOfBirth,
      gender:      this.form.gender,
      email:       this.form.email.trim()  || undefined,
      wilaya:      this.form.wilaya.trim() || undefined,
      commune:     this.form.commune.trim()|| undefined,
      nss:         this.form.nss.trim()    || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.page.set(1);
        this.load();
        this.toast.success(`Patient ${this.form.firstName} ${this.form.lastName} enregistré`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message ?? 'Erreur lors de la création');
      },
    });
  }

  viewPatient(id: string) {
    this.detailLoading.set(true);
    this.showDetailModal.set(true);
    this.api.get<Patient>(`patients/${id}`).subscribe({
      next: (p) => { this.selectedPatient.set(p); this.detailLoading.set(false); },
      error: () => { this.showDetailModal.set(false); this.detailLoading.set(false); this.toast.error('Patient introuvable'); },
    });
  }

  closeDetailModal() { this.showDetailModal.set(false); this.selectedPatient.set(null); }

  onSearch() { this.page.set(1); this.load(); }
  setPage(p: number) { this.page.set(p); this.load(); }
  totalPages() { return Math.ceil(this.total() / 20) || 1; }
  pages() { return Array.from({ length: this.totalPages() }, (_, i) => i + 1); }
  age(dateOfBirth?: string): string {
    if (!dateOfBirth) return '—';
    const diff = Date.now() - new Date(dateOfBirth).getTime();
    return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))) + ' ans';
  }
}
