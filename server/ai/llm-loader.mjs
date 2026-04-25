// ESM wrapper — node-llama-cpp is ESM-only, NestJS runs in CJS.
// This file is imported via dynamic import() to bridge the gap.
import { getLlama, LlamaChatSession } from 'node-llama-cpp';

export async function createLlama() {
  return getLlama();
}

export { LlamaChatSession };
