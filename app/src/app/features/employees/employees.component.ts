import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

const ROLE_LABELS: Record<string, string | undefined> = {
  ADMIN: 'Administrateur', DOCTEUR: 'Médecin', SECRETAIRE: 'Secrétaire', EMPLOYE: 'Employé',
};

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

interface Shift { day: number; start: string; end: string; }

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  shifts: Shift[] | null;
}

interface ShiftRow { day: number; label: string; enabled: boolean; start: string; end: string; }

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [PageHeaderComponent, LoadingSpinnerComponent, FormsModule, UpperCasePipe],
  templateUrl: './employees.component.html',
})
export class EmployeesComponent implements OnInit {
  private readonly api  = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly employees   = signal<Employee[]>([]);
  readonly loading     = signal(true);
  readonly roleLabels  = ROLE_LABELS;
  readonly dayLabels   = DAY_LABELS;

  // ── invite modal ─────────────────────────────────────────────────────────────
  readonly showModal   = signal(false);
  readonly sending      = signal(false);
  readonly sentOk       = signal(false);
  readonly tempPassword = signal('');
  readonly inviteError  = signal('');
  inviteEmail = '';
  inviteRole  = 'SECRETAIRE';
  readonly inviteRoles = [
    { value: 'DOCTEUR',    label: 'Médecin' },
    { value: 'SECRETAIRE', label: 'Secrétaire' },
    { value: 'EMPLOYE',    label: 'Employé' },
  ];

  // ── shifts modal ─────────────────────────────────────────────────────────────
  readonly showShiftsModal = signal(false);
  readonly savingShifts    = signal(false);
  readonly shiftsError     = signal('');
  selectedEmployee: Employee | null = null;
  shiftRows: ShiftRow[] = [];

  get currentUserId(): string | undefined { return this.auth.user()?.id; }

  ngOnInit() { this.load(); }

  private load() {
    this.api.get<Employee[]>('employees').subscribe({
      next: (res) => { this.employees.set(res ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // ── invite ───────────────────────────────────────────────────────────────────

  openInviteModal() {
    this.inviteEmail = '';
    this.inviteRole  = 'SECRETAIRE';
    this.sentOk.set(false);
    this.tempPassword.set('');
    this.inviteError.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  copyPassword() {
    navigator.clipboard.writeText(this.tempPassword()).catch(() => {});
  }

  sendByEmail() {
    const subject = encodeURIComponent('Invitation — Dawini');
    const body = encodeURIComponent(
      `Bonjour,\n\nVotre compte Dawini a été créé.\n\nEmail : ${this.inviteEmail}\nMot de passe temporaire : ${this.tempPassword()}\n\nConnectez-vous et changez votre mot de passe dès la première connexion.\n\nCordialement,`
    );
    window.open(`mailto:${this.inviteEmail}?subject=${subject}&body=${body}`);
  }

  sendInvite() {
    if (!this.inviteEmail) return;
    this.sending.set(true);
    this.inviteError.set('');
    this.api.post<{ tempPassword: string }>('employees/invite', { email: this.inviteEmail, role: this.inviteRole }).subscribe({
      next: (res) => { this.sending.set(false); this.tempPassword.set(res?.tempPassword ?? ''); this.sentOk.set(true); this.load(); },
      error: (err) => {
        this.sending.set(false);
        this.inviteError.set(err?.error?.message ?? 'Erreur lors de l\'envoi.');
      },
    });
  }

  // ── toggle active ─────────────────────────────────────────────────────────────

  toggleActive(emp: Employee) {
    this.api.patch<Employee>(`employees/${emp.id}/toggle-active`, {}).subscribe({
      next: (updated) => this.employees.update(list => list.map(e => e.id === updated.id ? updated : e)),
    });
  }

  // ── change role ───────────────────────────────────────────────────────────────

  changeRole(emp: Employee, role: string) {
    this.api.patch<Employee>(`employees/${emp.id}/role`, { role }).subscribe({
      next: (updated) => this.employees.update(list => list.map(e => e.id === updated.id ? updated : e)),
    });
  }

  // ── shifts ────────────────────────────────────────────────────────────────────

  openShiftsModal(emp: Employee) {
    this.selectedEmployee = emp;
    this.shiftsError.set('');
    this.shiftRows = DAY_LABELS.map((label, day) => {
      const existing = emp.shifts?.find(s => s.day === day);
      return {
        day,
        label,
        enabled: !!existing,
        start: existing?.start ?? '08:00',
        end:   existing?.end   ?? '17:00',
      };
    });
    this.showShiftsModal.set(true);
  }

  closeShiftsModal() { this.showShiftsModal.set(false); this.selectedEmployee = null; }

  saveShifts() {
    if (!this.selectedEmployee) return;
    const shifts = this.shiftRows
      .filter(r => r.enabled)
      .map(r => ({ day: r.day, start: r.start, end: r.end }));

    this.savingShifts.set(true);
    this.shiftsError.set('');
    this.api.patch<Employee>(`employees/${this.selectedEmployee.id}/shifts`, { shifts }).subscribe({
      next: (updated) => {
        this.employees.update(list => list.map(e => e.id === updated.id ? updated : e));
        this.savingShifts.set(false);
        this.closeShiftsModal();
      },
      error: (err) => {
        this.savingShifts.set(false);
        this.shiftsError.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
      },
    });
  }
}
