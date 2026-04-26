import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { PlatformService } from '../../core/services/platform.service';
import { AmiraService } from '../../core/services/amira.service';
import { ToastService } from '../../core/services/toast.service';
import { AmiraLibraryComponent } from '../amira/amira-library.component';

interface ConsultationType { label: string; fee: number; }

interface CabinetSettings {
  cabinetName: string | null;
  doctorFirstName: string | null;
  doctorLastName: string | null;
  specialty: string | null;
  ordreNumber: string | null;
  address: string | null;
  phone: string | null;
  wilaya: string | null;
  defaultConsultationDuration: number;
  consultationTypes: ConsultationType[];
}

type Tab = 'cabinet' | 'amira' | 'license' | 'app';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, AmiraLibraryComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  private readonly api      = inject(ApiService);
  private readonly platform = inject(PlatformService);
  private readonly amiraSvc = inject(AmiraService);
  private readonly toast    = inject(ToastService);

  // Amira status
  readonly amiraLoaded = signal(false);
  readonly amiraModel  = signal('');

  readonly loading = signal(true);
  readonly saving  = signal(false);
  readonly saved   = signal(false);
  readonly error   = signal('');
  readonly tab     = signal<Tab>('cabinet');

  readonly durations = [15, 30, 45, 60];

  // License
  readonly licenseState = signal('');
  readonly licenseDays  = signal(0);
  licenseKey = '';
  referralCode = '';
  readonly activating   = signal(false);
  readonly licenseError = signal('');
  readonly licenseOk    = signal('');

  // App info
  readonly appVersion = signal('');

  form: CabinetSettings = {
    cabinetName: null,
    doctorFirstName: null,
    doctorLastName: null,
    specialty: null,
    ordreNumber: null,
    address: null,
    phone: null,
    wilaya: null,
    defaultConsultationDuration: 30,
    consultationTypes: [{ label: 'Consultation', fee: 0 }],
  };

  addConsultationType() {
    this.form.consultationTypes.push({ label: '', fee: 0 });
  }

  removeConsultationType(index: number) {
    this.form.consultationTypes.splice(index, 1);
  }

  async ngOnInit() {
    this.api.get<CabinetSettings>('settings').subscribe({
      next: (res) => {
        Object.assign(this.form, res);
        if (!this.form.consultationTypes?.length) {
          this.form.consultationTypes = [{ label: 'Consultation', fee: 0 }];
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    // Load license and app info
    const status = await this.platform.getLicenseStatus();
    this.licenseState.set(status.state);
    this.licenseDays.set(status.daysLeft);
    this.appVersion.set(await this.platform.getVersion());

    // Load Amira status
    this.amiraSvc.getStatus().subscribe({
      next: (s) => {
        this.amiraLoaded.set(s.loaded);
        this.amiraModel.set(s.modelName || '');
      },
      error: () => {},
    });
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    this.api.patch('settings', this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Erreur lors de la sauvegarde.');
      },
    });
  }

  async activateLicense() {
    if (!this.licenseKey.trim()) return;
    this.activating.set(true);
    this.licenseError.set('');
    this.licenseOk.set('');

    const result = await this.platform.activateLicense(this.licenseKey.trim(), this.referralCode.trim() || undefined);
    this.activating.set(false);

    if (result.success) {
      this.licenseOk.set('Licence activée avec succès !');
      const status = await this.platform.getLicenseStatus();
      this.licenseState.set(status.state);
      this.licenseDays.set(status.daysLeft);
    } else {
      this.licenseError.set(result.error || 'Clé invalide.');
    }
  }

  checkForUpdates() {
    const api = (window as any).electronAPI;
    if (api?.checkForUpdates) {
      this.toast.info('Recherche de mise à jour...');
      api.checkForUpdates()
        .then((version: string | null) => {
          if (version) {
            this.toast.success(`Mise à jour v${version} disponible. Voir la bannière en haut.`);
          } else {
            this.toast.info('Vous utilisez la dernière version.');
          }
        })
        .catch(() => this.toast.error('Impossible de vérifier les mises à jour.'));
    }
  }
}
