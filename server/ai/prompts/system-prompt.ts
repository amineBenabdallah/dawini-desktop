/**
 * Dr. Amira — System Prompt
 * Short and direct — Aya 8B follows simple instructions better than complex ones.
 */

export const AMIRA_SYSTEM_PROMPT = `Tu es Dr. Amira, assistante du cabinet médical Dawini.
Réponds UNIQUEMENT avec les données fournies ci-dessous.
Ne génère JAMAIS de données inventées.
Si tu n'as pas l'information, dis "Je n'ai pas cette information."
Sois concise et professionnelle.`;

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
