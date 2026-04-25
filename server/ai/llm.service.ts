import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as http from 'http';

/**
 * LlmService — calls Ollama's local HTTP API.
 *
 * Ollama runs as a system service on localhost:11434.
 * Model: mistral (best instruction-following for medical French).
 * No ESM issues, no child processes, no hacks.
 * Just HTTP POST to localhost.
 */

const OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'mistral';

export interface LlmStatus {
  loaded: boolean;
  modelName: string | null;
  modelPath: string | null;
  ramUsageMb: number;
  gpuAccelerated: boolean;
  error: string | null;
}

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private model = DEFAULT_MODEL;
  private _status: LlmStatus = {
    loaded: false,
    modelName: null,
    modelPath: null,
    ramUsageMb: 0,
    gpuAccelerated: false,
    error: null,
  };

  get status(): LlmStatus { return { ...this._status }; }
  get isReady(): boolean { return this._status.loaded; }

  async onModuleInit(): Promise<void> {
    await this.checkOllama();
  }

  /**
   * Check if Ollama is running and the model is available.
   */
  async checkOllama(): Promise<void> {
    try {
      // Check Ollama is running
      const tags = await this.ollamaGet('/api/tags');
      const models = tags.models || [];
      const found = models.find((m: any) => m.name.startsWith(this.model.split(':')[0]));

      if (found) {
        this._status = {
          loaded: true,
          modelName: found.name,
          modelPath: 'Ollama local',
          ramUsageMb: Math.round((found.size || 0) / (1024 * 1024)),
          gpuAccelerated: true,
          error: null,
        };
        this.logger.log(`Ollama model ready: ${found.name}`);
      } else {
        this._status.error = `Model "${this.model}" not found in Ollama. Run: ollama pull ${this.model}`;
        this.logger.warn(this._status.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ollama not reachable';
      this._status.error = `Ollama non disponible: ${message}. Vérifiez qu'Ollama est lancé.`;
      this.logger.warn(this._status.error);
    }
  }

  /**
   * Generate a complete response.
   */
  async generate(prompt: string, maxTokens = 200): Promise<string> {
    this.ensureReady();

    const body = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        num_predict: maxTokens,
        temperature: 0.3,
      },
    };

    const result = await this.ollamaPost('/api/generate', body);
    return result.response || '';
  }

  /**
   * Stream response token by token.
   */
  async *stream(prompt: string, maxTokens = 500): AsyncGenerator<string, void, unknown> {
    this.ensureReady();

    const body = {
      model: this.model,
      prompt,
      stream: true,
      options: {
        num_predict: maxTokens,
        temperature: 0.3,
      },
    };

    const chunks = await this.ollamaPostStream('/api/generate', body);
    for await (const chunk of chunks) {
      if (chunk.response) {
        yield chunk.response;
      }
      if (chunk.done) break;
    }
  }

  // ── Ollama HTTP helpers ────────────────────────────────────────────────

  private ollamaGet(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = http.get(`${OLLAMA_URL}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON from Ollama')); }
        });
      });
      req.on('error', (err) => reject(err));
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('Ollama timeout')); });
    });
  }

  private ollamaPost(urlPath: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const url = new URL(`${OLLAMA_URL}${urlPath}`);

      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      }, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(responseData)); }
          catch { reject(new Error('Invalid JSON from Ollama')); }
        });
      });

      req.on('error', (err) => reject(new LlmGenerationError(`Ollama error: ${err.message}`)));
      req.setTimeout(300000, () => { req.destroy(); reject(new LlmGenerationError('Ollama generation timeout')); });
      req.write(data);
      req.end();
    });
  }

  private async *ollamaPostStream(urlPath: string, body: any): AsyncGenerator<any, void, unknown> {
    const data = JSON.stringify(body);
    const url = new URL(`${OLLAMA_URL}${urlPath}`);

    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      }, resolve);
      req.on('error', reject);
      req.setTimeout(300000, () => { req.destroy(); reject(new Error('timeout')); });
      req.write(data);
      req.end();
    });

    let buffer = '';
    for await (const chunk of response) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          try { yield JSON.parse(line); } catch {}
        }
      }
    }
  }

  private ensureReady(): void {
    if (!this._status.loaded) {
      throw new LlmNotAvailableError(
        'Amira n\'est pas disponible. ' + (this._status.error || 'Vérifiez qu\'Ollama est lancé avec le modèle aya:8b.'),
      );
    }
  }
}

export class LlmNotAvailableError extends Error {
  constructor(message: string) { super(message); this.name = 'LlmNotAvailableError'; }
}

export class LlmGenerationError extends Error {
  constructor(message: string) { super(message); this.name = 'LlmGenerationError'; }
}
