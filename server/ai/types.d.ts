// Type declarations for dynamically imported AI packages.
// These packages are installed separately and loaded at runtime.
// If not installed, the services degrade gracefully.

declare module 'node-llama-cpp' {
  export function getLlama(): Promise<any>;
  export class LlamaChatSession {
    constructor(options: any);
    prompt(text: string, options?: any): Promise<string>;
    dispose(): void;
  }
}

declare module 'vectordb' {
  export function connect(path: string): Promise<any>;
}

declare module '@lancedb/lancedb' {
  export function connect(path: string): Promise<any>;
}

declare module '@xenova/transformers' {
  export function pipeline(task: string, model: string): Promise<any>;
}

declare module 'pdf-parse' {
  function parse(buffer: Buffer): Promise<{ text: string; numpages: number }>;
  export = parse;
}

declare module 'mammoth' {
  export function extractRawText(options: { buffer: Buffer }): Promise<{ value: string }>;
}
