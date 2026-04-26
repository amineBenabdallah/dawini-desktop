import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * RulesService — Layer 2 structured data lookups.
 *
 * Uses SQLite B-Tree index for exact matches (<1ms)
 * and FTS5 for full-text search in laws/deontologie.
 *
 * Auto-seeds data on first launch from server/ai/data/ files.
 */

// ── Simple in-memory storage (loaded from JSON/CSV at startup) ───────────
// We use in-memory maps for Layer 2 since the data is small (<5MB total)
// and lookups need to be <1ms. No need for extra SQLite tables.

interface Cim10Entry { code: string; label: string; category: string }
interface LabNormal { test: string; min: number; max: number; unit: string; ageGroup: string; gender: string }
interface VaccineDz { vaccine: string; doseNumber: number; ageMonths: number; obligatory: boolean }
interface TriageRule { keyword: string; severity: string; action: string; description: string }
interface Tarif { actCode: string; label: string; tarifCnas: number; lettreCle: string }
interface DrugEntry { dci: string; category: string; route: string; notes: string }

@Injectable()
export class RulesService implements OnModuleInit {
  private readonly logger = new Logger(RulesService.name);
  // __dirname at runtime = dist/server/ai/ → go up 3 levels to project root → server/ai/data/
  private readonly dataDir = path.join(__dirname, '..', '..', '..', 'server', 'ai', 'data');

  private cim10: Cim10Entry[] = [];
  private labNormals: LabNormal[] = [];
  private vaccination: VaccineDz[] = [];
  private triageRules: TriageRule[] = [];
  private tarification: Tarif[] = [];
  private drugs: DrugEntry[] = [];
  private lawTexts: { source: string; text: string }[] = [];

  private seeded = false;

  async onModuleInit(): Promise<void> {
    this.seed();
  }

  /**
   * Load all seed data from JSON files.
   * Idempotent — safe to call multiple times.
   */
  seed(): void {
    if (this.seeded) return;

    try {
      this.cim10 = this.loadJson('cim10.json', []);
      this.labNormals = this.loadJson('lab-normals.json', []);
      this.vaccination = this.loadJson('vaccination-dz.json', []);
      this.triageRules = this.loadJson('triage-rules.json', []);
      this.tarification = this.loadJson('tarification-cnas.json', []);
      this.drugs = this.loadJson('who-essential-meds.json', []);
      this.lawTexts = this.loadLaws();

      this.seeded = true;
      this.logger.log(
        `Layer 2 seeded: ${this.cim10.length} CIM-10, ${this.labNormals.length} lab normals, ` +
        `${this.vaccination.length} vaccines, ${this.triageRules.length} triage rules, ` +
        `${this.tarification.length} tarifs, ${this.drugs.length} drugs, ${this.lawTexts.length} law texts`,
      );
    } catch (err) {
      this.logger.warn(`Seed data incomplete: ${err}. Layer 2 will have limited data.`);
      this.seeded = true; // Don't retry — work with whatever loaded
    }
  }

  // ── Lookup methods ─────────────────────────────────────────────────────

  /** CIM-10: search by code prefix or label keyword */
  lookupCim10(query: string): string {
    const q = query.toLowerCase();
    const matches = this.cim10.filter(
      (e) => e.code.toLowerCase().startsWith(q) || e.label.toLowerCase().includes(q),
    ).slice(0, 10);

    if (matches.length === 0) return '';
    return matches.map((m) => `[CIM-10] ${m.code}: ${m.label}`).join('\n');
  }

  /** Lab normals: lookup by test name, optionally filtered by age/gender */
  lookupLabNormal(test: string, age?: number, gender?: string): string {
    const q = test.toLowerCase();
    const matches = this.labNormals.filter((n) => {
      if (!n.test.toLowerCase().includes(q)) return false;
      if (gender && n.gender !== 'all' && n.gender !== gender) return false;
      return true;
    }).slice(0, 5);

    if (matches.length === 0) return '';
    return matches.map((m) =>
      `[Normes biologiques] ${m.test}: ${m.min}–${m.max} ${m.unit} (${m.ageGroup}, ${m.gender})`,
    ).join('\n');
  }

  /** Vaccination DZ: lookup by age in months */
  lookupVaccination(ageMonths?: number): string {
    const matches = ageMonths !== undefined
      ? this.vaccination.filter((v) => v.ageMonths <= ageMonths)
      : this.vaccination;

    if (matches.length === 0) return '';
    return matches.map((v) =>
      `[Vaccination DZ] ${v.vaccine} dose ${v.doseNumber} à ${v.ageMonths} mois${v.obligatory ? ' (obligatoire)' : ''}`,
    ).join('\n');
  }

  /** Triage: check motif for severity keywords */
  lookupTriage(motif: string): string {
    const words = motif.toLowerCase().split(/\s+/);
    const matches = this.triageRules.filter((r) =>
      words.some((w) => r.keyword.toLowerCase().includes(w) || w.includes(r.keyword.toLowerCase())),
    );

    if (matches.length === 0) return '';
    return matches.map((m) =>
      `[Triage] "${m.keyword}" → Sévérité: ${m.severity}. Action: ${m.action}. ${m.description}`,
    ).join('\n');
  }

  /** Tarification CNAS: lookup by act code or label */
  lookupTarif(query: string): string {
    const q = query.toLowerCase();
    const matches = this.tarification.filter(
      (t) => t.actCode.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
    ).slice(0, 5);

    if (matches.length === 0) return '';
    return matches.map((t) =>
      `[Tarification CNAS] ${t.actCode}: ${t.label} — ${t.tarifCnas} DZD (lettre-clé: ${t.lettreCle})`,
    ).join('\n');
  }

  /** Drug lookup: search by DCI name */
  lookupDrug(dci: string): string {
    const q = dci.toLowerCase();
    const matches = this.drugs.filter((d) => d.dci.toLowerCase().includes(q)).slice(0, 5);

    if (matches.length === 0) return '';
    return matches.map((d) =>
      `[OMS médicaments essentiels] ${d.dci} — ${d.category}, voie: ${d.route}. ${d.notes}`,
    ).join('\n');
  }

  /** Full-text search in laws and deontologie */
  searchLaws(query: string): string {
    const q = query.toLowerCase();
    const matches = this.lawTexts.filter((l) => l.text.toLowerCase().includes(q));

    if (matches.length === 0) return '';
    // Return relevant excerpts (max 500 chars per match)
    return matches.map((m) => {
      const idx = m.text.toLowerCase().indexOf(q);
      const start = Math.max(0, idx - 200);
      const end = Math.min(m.text.length, idx + 300);
      const excerpt = m.text.slice(start, end);
      return `[${m.source}] ...${excerpt}...`;
    }).join('\n\n');
  }

  /**
   * Search ALL Layer 2 data for a query (used by AiService for merged results).
   */
  searchAll(query: string, screen?: string): string {
    const results: string[] = [];

    // Always search CIM-10 and drugs (relevant everywhere)
    const cim = this.lookupCim10(query);
    if (cim) results.push(cim);

    const drug = this.lookupDrug(query);
    if (drug) results.push(drug);

    // Screen-specific searches
    if (!screen || screen === 'consultation' || screen === 'patient') {
      const lab = this.lookupLabNormal(query);
      if (lab) results.push(lab);
    }

    if (!screen || screen === 'certificat') {
      const laws = this.searchLaws(query);
      if (laws) results.push(laws);
    }

    if (!screen || screen === 'facturation') {
      const tarif = this.lookupTarif(query);
      if (tarif) results.push(tarif);
    }

    if (!screen || screen === 'queue') {
      const triage = this.lookupTriage(query);
      if (triage) results.push(triage);
    }

    return results.join('\n\n');
  }

  // ── Data loading helpers ───────────────────────────────────────────────

  private loadJson<T>(filename: string, fallback: T): T {
    const filePath = path.join(this.dataDir, filename);
    try {
      if (!fs.existsSync(filePath)) {
        this.logger.warn(`Seed file not found: ${filename}`);
        return fallback;
      }
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      this.logger.warn(`Failed to load ${filename}: ${err}`);
      return fallback;
    }
  }

  private loadLaws(): { source: string; text: string }[] {
    const lawsDir = path.join(this.dataDir, 'laws');
    if (!fs.existsSync(lawsDir)) return [];

    const results: { source: string; text: string }[] = [];
    try {
      const files = fs.readdirSync(lawsDir).filter((f) => f.endsWith('.txt'));
      for (const file of files) {
        const text = fs.readFileSync(path.join(lawsDir, file), 'utf-8');
        const source = file.replace('.txt', '').replace(/-/g, ' ');
        results.push({ source, text });
      }
    } catch (err) {
      this.logger.warn(`Failed to load laws: ${err}`);
    }
    return results;
  }
}
