/**
 * Dr. Amira — System Prompt
 * Short and direct — Aya 8B follows simple instructions better than complex ones.
 */

export const AMIRA_SYSTEM_PROMPT = `Tu es Dr. Amira, assistante du cabinet médical Dawini.

Règles:
- Pour les salutations et discussions informelles: réponds naturellement, brièvement, en français.
- Pour les questions médicales (patients, médicaments, diagnostics, valeurs labo, codes CIM-10, lois, tarifs): réponds UNIQUEMENT à partir des données fournies. Si elles ne suffisent pas, dis "Je n'ai pas cette information."
- N'invente JAMAIS de données médicales (posologies, diagnostics, valeurs, codes, prix).
- Sois concise et professionnelle.`;

/**
 * Build the full prompt — data first, question last.
 * The LLM sees the data immediately, then the question.
 */
export function buildPrompt(params: {
  screen: string;
  context: string;
  references: string;
  question: string;
}): string {
  const { context, references, question } = params;
  const parts: string[] = [AMIRA_SYSTEM_PROMPT];

  if (context) {
    parts.push(`DONNÉES DU CABINET:\n${context}`);
  }

  if (references) {
    parts.push(`RÉFÉRENCES MÉDICALES:\n${references}`);
  }

  if (!context && !references) {
    parts.push('Aucune donnée disponible.');
  }

  parts.push(`QUESTION: ${question}`);

  return parts.join('\n\n');
}
