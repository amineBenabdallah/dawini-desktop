import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Patient } from '../patient/entities/patient.entity';
import { Consultation } from '../consultation/entities/consultation.entity';
import { Ordonnance } from '../ordonnance/entities/ordonnance.entity';
import { LigneOrdonnance } from '../ordonnance/entities/ligne-ordonnance.entity';
import { Certificat } from '../certificat/entities/certificat.entity';
import { RendezVous } from '../rendez-vous/entities/rendez-vous.entity';
import { CabinetService } from '../common/services/cabinet.service';

/**
 * ContextService — Builds screen-specific context for LLM prompts.
 *
 * This is how Amira "knows" about the app data.
 * Not a separate layer — it's the bridge between the DB and the prompt.
 *
 * READ-ONLY — never creates, updates, or deletes any data.
 * Minimum data principle — each screen gets ONLY what it needs.
 */

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Consultation) private consultRepo: Repository<Consultation>,
    @InjectRepository(Ordonnance) private ordRepo: Repository<Ordonnance>,
    @InjectRepository(LigneOrdonnance) private ligneRepo: Repository<LigneOrdonnance>,
    @InjectRepository(Certificat) private certRepo: Repository<Certificat>,
    @InjectRepository(RendezVous) private rdvRepo: Repository<RendezVous>,
    private cabinetService: CabinetService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  //  SCREEN-SPECIFIC CONTEXTS
  // ══════════════════════════════════════════════════════════════════════

  async getConsultationContext(patientId?: string, consultationId?: string): Promise<string> {
    const parts: string[] = [];

    if (patientId) {
      parts.push(await this.getPatientFull(patientId));
    }

    if (consultationId) {
      const consult = await this.consultRepo.findOne({ where: { id: consultationId } });
      if (consult) {
        const vitals: string[] = [];
        if (consult.tensionArterielle) vitals.push(`TA: ${consult.tensionArterielle}`);
        if (consult.poids) vitals.push(`Poids: ${consult.poids}kg`);
        if (consult.temperature) vitals.push(`Température: ${consult.temperature}°C`);
        if (vitals.length) parts.push(`Signes vitaux actuels: ${vitals.join(', ')}`);
        if (consult.motif) parts.push(`Motif: ${consult.motif}`);
        if (consult.diagnostic) parts.push(`Diagnostic: ${consult.diagnostic}`);
        if (consult.traitement) parts.push(`Traitement: ${consult.traitement}`);
      }
    }

    return parts.filter(Boolean).join('\n\n');
  }

  async getOrdonnanceContext(patientId?: string): Promise<string> {
    if (!patientId) return '';
    const parts: string[] = [];
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (patient) {
      const age = this.calculateAge(patient.dateOfBirth);
      parts.push(`Patient: ${patient.firstName} ${patient.lastName}, ${age} ans, ${patient.gender}`);
    }
    const meds = await this.getCurrentMedications(patientId);
    if (meds) parts.push(`Médicaments en cours:\n${meds}`);
    return parts.join('\n\n');
  }

  async getCertificatContext(patientId?: string, consultationId?: string): Promise<string> {
    const parts: string[] = [];
    if (patientId) {
      const patient = await this.patientRepo.findOne({ where: { id: patientId } });
      if (patient) {
        parts.push(`Patient: ${patient.firstName} ${patient.lastName}, ${this.calculateAge(patient.dateOfBirth)} ans`);
      }
    }
    if (consultationId) {
      const consult = await this.consultRepo.findOne({ where: { id: consultationId } });
      if (consult?.diagnostic) parts.push(`Diagnostic: ${consult.diagnostic}`);
      if (consult?.motif) parts.push(`Motif: ${consult.motif}`);
    }
    return parts.join('\n\n');
  }

  async getPatientContext(patientId?: string): Promise<string> {
    if (!patientId) return '';
    return this.getPatientFull(patientId);
  }

  getTriageContext(motif?: string): string {
    return motif ? `Motif de consultation: ${motif}` : '';
  }

  async getFacturationContext(consultationId?: string): Promise<string> {
    if (!consultationId) return '';
    const consult = await this.consultRepo.findOne({ where: { id: consultationId } });
    if (!consult) return '';
    return `Type de consultation: ${consult.motif || 'Non spécifié'}`;
  }

  /**
   * Dashboard context — rich summary of today's activity.
   * Amira can answer: "combien de RDV?", "qui est prévu?", "quoi de neuf?"
   */
  async getDashboardContext(): Promise<string> {
    const cabinetId = this.cabinetService.getCabinetId();
    const parts: string[] = [];
    const { startOfDay, endOfDay } = this.getTodayRange();

    parts.push(`Date: ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);

    // Today's appointments with details
    const todayRdv = await this.rdvRepo.find({
      where: { cabinetId, dateHeure: Between(startOfDay, endOfDay) },
      order: { dateHeure: 'ASC' },
    });

    if (todayRdv.length > 0) {
      const rdvList = await Promise.all(todayRdv.map(async (r) => {
        const patient = r.patientId ? await this.patientRepo.findOne({ where: { id: r.patientId } }) : null;
        const time = new Date(r.dateHeure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const name = patient ? `${patient.firstName} ${patient.lastName}` : 'Patient inconnu';
        return `  • ${time} — ${name} — ${r.motif} (${r.statut})`;
      }));
      parts.push(`Rendez-vous aujourd'hui (${todayRdv.length}):\n${rdvList.join('\n')}`);
    } else {
      parts.push('Aucun rendez-vous aujourd\'hui.');
    }

    // Today's consultations done
    const todayConsults = await this.consultRepo.find({
      where: { cabinetId, dateConsultation: Between(startOfDay, endOfDay) },
    });
    parts.push(`Consultations effectuées aujourd'hui: ${todayConsults.length}`);

    // Total patients
    const totalPatients = await this.patientRepo.count({ where: { cabinetId, isActive: true } });
    parts.push(`Total patients actifs: ${totalPatients}`);

    // Unpaid invoices count (quick stat)
    parts.push(await this.getOverdueFollowups(cabinetId));

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Free chat — pulls everything relevant based on current screen.
   * For general questions without a specific screen, pulls a global summary.
   */
  async getChatContext(screen?: string, patientId?: string, consultationId?: string, question?: string): Promise<string> {
    switch (screen) {
      case 'consultation': return this.getConsultationContext(patientId, consultationId);
      case 'ordonnance': return this.getOrdonnanceContext(patientId);
      case 'certificat': return this.getCertificatContext(patientId, consultationId);
      case 'patient': return this.getPatientContext(patientId);
      case 'facturation': return this.getFacturationContext(consultationId);
      case 'dashboard': return this.getDashboardContext();
      case 'queue': return this.getTriageContext();
      default:
        if (patientId) return this.getPatientFull(patientId);
        // For general chat — pull data based on what the question is about
        return this.getSmartContext(question);
    }
  }

  /**
   * Smart context — analyzes the question to pull the right DB data.
   * This is how Amira knows about RDVs, patients, consultations, etc.
   */
  private async getSmartContext(question?: string): Promise<string> {
    const q = (question || '').toLowerCase();
    const cabinetId = this.cabinetService.getCabinetId();
    const parts: string[] = [];

    parts.push(`Date actuelle: ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);

    // Always include today's overview
    const { startOfDay, endOfDay } = this.getTodayRange();

    // RDV-related questions
    if (q.match(/rdv|rendez|agenda|semaine|demain|aujourd|planning|prochain/)) {
      const rdvs = await this.rdvRepo.query(
        `SELECT r.*, p.firstName as patientFirstName, p.lastName as patientLastName
         FROM rendez_vous r
         LEFT JOIN patients p ON r.patientId = p.id
         WHERE r.cabinetId = ?
         ORDER BY r.dateHeure ASC`,
        [cabinetId],
      );

      if (rdvs.length > 0) {
        // Group by period (today, tomorrow, this week, next week) for the LLM
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const endOfTomorrow = new Date(tomorrow); endOfTomorrow.setDate(tomorrow.getDate() + 1);
        const nextMonday = new Date(today); nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
        const nextSunday = new Date(nextMonday); nextSunday.setDate(nextMonday.getDate() + 6);

        const formatRdv = (r: any) => {
          const d = new Date(r.dateHeure);
          const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
          const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const name = r.patientFirstName ? `${r.patientFirstName} ${r.patientLastName}` : 'Patient inconnu';
          return `  • ${dateStr} à ${timeStr} — ${name} — ${r.motif} (${r.statut})`;
        };

        const todayRdvs = rdvs.filter((r: any) => { const d = new Date(r.dateHeure); return d >= today && d < tomorrow; });
        const tomorrowRdvs = rdvs.filter((r: any) => { const d = new Date(r.dateHeure); return d >= tomorrow && d < endOfTomorrow; });
        const nextWeekRdvs = rdvs.filter((r: any) => { const d = new Date(r.dateHeure); return d >= nextMonday && d <= nextSunday; });
        const otherRdvs = rdvs.filter((r: any) => { const d = new Date(r.dateHeure); return d > nextSunday; });

        if (todayRdvs.length) parts.push(`RDV AUJOURD'HUI (${todayRdvs.length}):\n${todayRdvs.map(formatRdv).join('\n')}`);
        else parts.push("RDV AUJOURD'HUI: Aucun.");

        if (tomorrowRdvs.length) parts.push(`RDV DEMAIN (${tomorrowRdvs.length}):\n${tomorrowRdvs.map(formatRdv).join('\n')}`);
        else parts.push("RDV DEMAIN: Aucun.");

        if (nextWeekRdvs.length) parts.push(`RDV SEMAINE PROCHAINE (${nextWeekRdvs.length}):\n${nextWeekRdvs.map(formatRdv).join('\n')}`);
        else parts.push("RDV SEMAINE PROCHAINE: Aucun.");

        if (otherRdvs.length) parts.push(`AUTRES RDV (${otherRdvs.length}):\n${otherRdvs.map(formatRdv).join('\n')}`);
      } else {
        parts.push('Aucun rendez-vous trouvé dans le système.');
      }
    }

    // Patient-related questions
    if (q.match(/patient|combien|nombre|total|liste/)) {
      const total = await this.patientRepo.count({ where: { cabinetId, isActive: true } });
      parts.push(`Nombre total de patients actifs: ${total}`);

      // Last 5 patients
      const recent = await this.patientRepo.find({
        where: { cabinetId, isActive: true },
        order: { createdAt: 'DESC' },
        take: 5,
      });
      if (recent.length) {
        const list = recent.map((p) =>
          `  • ${p.firstName} ${p.lastName} (${p.patientNumber}) — ${p.phone}`
        );
        parts.push(`Derniers patients ajoutés:\n${list.join('\n')}`);
      }
    }

    // Consultation-related questions
    if (q.match(/consultation|consult|aujourd|visite/)) {
      const todayConsults = await this.consultRepo.createQueryBuilder('c')
        .where('c.cabinetId = :cabinetId', { cabinetId })
        .andWhere('c.dateConsultation >= :from', { from: startOfDay.toISOString().replace('T', ' ').slice(0, 19) })
        .andWhere('c.dateConsultation <= :to', { to: endOfDay.toISOString().replace('T', ' ').slice(0, 19) })
        .getMany();
      parts.push(`Consultations aujourd'hui: ${todayConsults.length}`);
    }

    // If no specific data was pulled, give a general overview
    if (parts.length <= 1) {
      const dashboard = await this.getDashboardContext();
      return dashboard;
    }

    return parts.filter(Boolean).join('\n\n');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PRIVATE — Data fetchers
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Full patient profile — everything Amira needs to know about a patient.
   */
  private async getPatientFull(patientId: string): Promise<string> {
    const cabinetId = this.cabinetService.getCabinetId();
    const parts: string[] = [];

    // Basic info
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (!patient) return 'Patient introuvable.';

    const age = this.calculateAge(patient.dateOfBirth);
    parts.push(`Patient: ${patient.firstName} ${patient.lastName}, ${age} ans, ${patient.gender === 'M' ? 'homme' : 'femme'}`);
    if (patient.phone) parts.push(`Tél: ${patient.phone}`);
    if (patient.nss) parts.push(`NSS: ${patient.nss}`);

    // Current medications
    const meds = await this.getCurrentMedications(patientId);
    if (meds) parts.push(`Traitement en cours:\n${meds}`);

    // Recent consultations (last 10)
    const consultations = await this.consultRepo.find({
      where: { patientId, cabinetId },
      order: { dateConsultation: 'DESC' },
      take: 10,
    });
    if (consultations.length) {
      const consultList = consultations.map((c) => {
        const date = new Date(c.dateConsultation).toLocaleDateString('fr-FR');
        const vitals: string[] = [];
        if (c.tensionArterielle) vitals.push(`TA ${c.tensionArterielle}`);
        if (c.poids) vitals.push(`${c.poids}kg`);
        if (c.temperature) vitals.push(`${c.temperature}°C`);
        return `  • ${date}: ${c.motif}${c.diagnostic ? ` → ${c.diagnostic}` : ''}${vitals.length ? ` (${vitals.join(', ')})` : ''} [${c.statut}]`;
      });
      parts.push(`Historique consultations (${consultations.length}):\n${consultList.join('\n')}`);
    }

    // Upcoming appointments
    const now = new Date();
    const upcomingRdv = await this.rdvRepo.find({
      where: { patientId, cabinetId },
      order: { dateHeure: 'ASC' },
      take: 5,
    });
    const futureRdv = upcomingRdv.filter((r) => new Date(r.dateHeure) >= now);
    if (futureRdv.length) {
      const rdvList = futureRdv.map((r) => {
        const date = new Date(r.dateHeure).toLocaleDateString('fr-FR');
        const time = new Date(r.dateHeure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `  • ${date} ${time} — ${r.motif} (${r.statut})`;
      });
      parts.push(`Prochains rendez-vous:\n${rdvList.join('\n')}`);
    }

    // Recent certificats
    const certs = await this.certRepo.find({
      where: { patientId, cabinetId },
      order: { dateEmission: 'DESC' },
      take: 3,
    });
    if (certs.length) {
      const certList = certs.map((c) => {
        const date = new Date(c.dateEmission).toLocaleDateString('fr-FR');
        return `  • ${date}: ${c.type} — ${c.numero} [${c.statut}]`;
      });
      parts.push(`Derniers certificats:\n${certList.join('\n')}`);
    }

    return parts.join('\n\n');
  }

  private async getCurrentMedications(patientId: string): Promise<string | null> {
    const cabinetId = this.cabinetService.getCabinetId();
    const lastOrd = await this.ordRepo.findOne({
      where: { patientId, cabinetId, statut: 'ACTIVE' as any },
      order: { dateEmission: 'DESC' },
    });
    if (!lastOrd) return null;

    const lignes = await this.ligneRepo.find({ where: { ordonnanceId: lastOrd.id, cabinetId } });
    if (!lignes.length) return null;

    return lignes.map((l) =>
      `  • ${l.medicament}${l.dosage ? ` ${l.dosage}` : ''}${l.duree ? ` (${l.duree})` : ''}`,
    ).join('\n');
  }

  private async getOverdueFollowups(cabinetId: string): Promise<string> {
    // Patients with last consultation > 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentPatientIds = await this.consultRepo.createQueryBuilder('c')
      .select('DISTINCT c.patientId')
      .where('c.cabinetId = :cabinetId', { cabinetId })
      .andWhere('c.dateConsultation >= :since', { since: threeMonthsAgo.toISOString() })
      .getRawMany();

    const recentIds = new Set(recentPatientIds.map((r: any) => r.patientId));
    const totalActive = await this.patientRepo.count({ where: { cabinetId, isActive: true } });
    const overdueCount = totalActive - recentIds.size;

    if (overdueCount > 0) {
      return `Patients sans consultation depuis 3+ mois: ${overdueCount}`;
    }
    return '';
  }

  private getTodayRange() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    return { startOfDay, endOfDay };
  }

  private calculateAge(dateOfBirth: string): number {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
}
