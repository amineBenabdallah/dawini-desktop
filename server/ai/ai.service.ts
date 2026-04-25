import { Injectable, Logger } from '@nestjs/common';
import { LlmService, LlmNotAvailableError } from './llm.service';
import { RagService } from './rag.service';
import { RulesService } from './rules.service';
import { ContextService } from './context.service';
import { buildPrompt } from './prompts/system-prompt';

/**
 * AiService — The orchestrator.
 *
 * For every query:
 * 1. Gather screen-specific context (ContextService)
 * 2. Search Layer 1 — doctor's PDFs (RagService / HNSW)
 * 3. Search Layer 2 — pre-bundled data (RulesService / B-Tree+FTS5)
 * 4. Merge all references
 * 5. Build prompt (system + context + refs + question)
 * 6. Call LLM (stream or generate)
 *
 * The LLM speaks ONLY from the provided references.
 */

export interface AiQueryParams {
  screen: string;
  question: string;
  patientId?: string;
  consultationId?: string;
}

export interface AiResponse {
  text: string;
  sources: { source: string; page: number }[];
  fromReferences: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly rag: RagService,
    private readonly rules: RulesService,
    private readonly context: ContextService,
  ) {}

  /**
   * Full query pipeline — returns complete response (for whisper/suggest).
   */
  async query(params: AiQueryParams): Promise<AiResponse> {
    this.validateQuery(params);

    const { prompt, sources, hasReferences } = await this.buildFullPrompt(params);

    if (!this.llm.isReady) {
      throw new AmiraNotAvailableError(
        'Amira n\'est pas disponible. Aucun modèle IA chargé. ' +
        'Allez dans Paramètres > Dr. Amira pour configurer.',
      );
    }

    const maxTokens = params.screen === 'queue' ? 50 : 200;
    const text = await this.llm.generate(prompt, maxTokens);

    return { text, sources, fromReferences: hasReferences };
  }

  /**
   * Streaming query pipeline — yields tokens progressively (for talk panel).
   */
  async *stream(params: AiQueryParams): AsyncGenerator<{ token: string; done: boolean; sources?: { source: string; page: number }[] }, void, unknown> {
    this.validateQuery(params);

    const { prompt, sources, hasReferences } = await this.buildFullPrompt(params);

    if (!this.llm.isReady) {
      yield { token: 'Amira n\'est pas disponible. Aucun modèle IA chargé.', done: true, sources: [] };
      return;
    }

    const maxTokens = 500;
    const generator = this.llm.stream(prompt, maxTokens);

    for await (const token of generator) {
      yield { token, done: false };
    }

    yield { token: '', done: true, sources };
  }

  /**
   * Quick vital sign check — fast response for whisper mode.
   */
  async checkVitals(vitals: { ta?: string; poids?: number; temp?: number }, patientId?: string): Promise<string | null> {
    const alerts: string[] = [];

    if (vitals.ta) {
      const parts = vitals.ta.split('/').map(Number);
      if (parts.length === 2) {
        const [sys, dia] = parts;
        if (sys >= 180 || dia >= 110) alerts.push(`TA ${vitals.ta} = HTA grade 3 (urgence)`);
        else if (sys >= 160 || dia >= 100) alerts.push(`TA ${vitals.ta} = HTA grade 2`);
        else if (sys >= 140 || dia >= 90) alerts.push(`TA ${vitals.ta} = HTA grade 1`);
        else if (sys < 90 || dia < 60) alerts.push(`TA ${vitals.ta} = Hypotension`);
      }
    }

    if (vitals.temp !== undefined) {
      if (vitals.temp >= 40) alerts.push(`Température ${vitals.temp}°C = Hyperthermie sévère`);
      else if (vitals.temp >= 38.5) alerts.push(`Température ${vitals.temp}°C = Fièvre`);
      else if (vitals.temp < 35) alerts.push(`Température ${vitals.temp}°C = Hypothermie`);
    }

    if (alerts.length === 0) return null;

    // If LLM is available, get a short recommendation
    if (this.llm.isReady) {
      const context = patientId ? await this.context.getConsultationContext(patientId) : '';
      const rulesData = this.rules.lookupLabNormal('tension', undefined, undefined);
      const refs = rulesData || '';

      const prompt = buildPrompt({
        screen: 'consultation',
        context: `${context}\nAlertes vitaux: ${alerts.join(', ')}`,
        references: refs,
        question: `Résume en une phrase courte (max 20 mots) l'alerte sur ces signes vitaux.`,
      });

      try {
        return await this.llm.generate(prompt, 50);
      } catch {
        return alerts.join('. ');
      }
    }

    return alerts.join('. ');
  }

  /**
   * Get LLM status for the frontend.
   */
  getStatus() {
    return this.llm.status;
  }

  // ── Private ────────────────────────────────────────────────────────────

  private async buildFullPrompt(params: AiQueryParams) {
    const { screen, question, patientId, consultationId } = params;

    // 1. Screen-specific context (passes question so smart context can pull relevant DB data)
    const contextText = await this.context.getChatContext(screen, patientId, consultationId, question);

    // 2. Search Layer 1 (doctor's PDFs)
    const ragResults = await this.rag.search(question, 5);
    const ragText = ragResults.map((r, i) =>
      `[L1 — ${r.source}, p.${r.page}]\n${r.text}`,
    ).join('\n\n');

    // 3. Search Layer 2 (pre-bundled rules)
    const rulesText = this.rules.searchAll(question, screen);

    // 4. Merge references
    const allRefs = [ragText, rulesText].filter(Boolean).join('\n\n');
    const hasReferences = allRefs.trim().length > 0;

    // 5. Collect sources for citation
    const sources = ragResults.map((r) => ({ source: r.source, page: r.page }));

    // 6. Build prompt
    this.logger.log(`Context length: ${contextText.length} chars, Refs length: ${allRefs.length} chars`);
    this.logger.log(`Context preview: ${contextText.slice(0, 200)}`);
    const prompt = buildPrompt({
      screen,
      context: contextText,
      references: allRefs,
      question,
    });

    return { prompt, sources, hasReferences };
  }

  private validateQuery(params: AiQueryParams): void {
    if (!params.question || params.question.trim().length === 0) {
      throw new AmiraValidationError('La question ne peut pas être vide.');
    }
    if (params.question.length > 2000) {
      throw new AmiraValidationError('La question est trop longue (max 2000 caractères).');
    }

    const validScreens = [
      'consultation', 'ordonnance', 'certificat', 'facturation',
      'patient', 'queue', 'dashboard', 'rendezvous', 'chat',
    ];
    if (!validScreens.includes(params.screen)) {
      throw new AmiraValidationError(`Écran invalide: ${params.screen}`);
    }
  }
}

// ── Custom errors ────────────────────────────────────────────────────────────

export class AmiraNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmiraNotAvailableError';
  }
}

export class AmiraValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmiraValidationError';
  }
}
