import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

/**
 * RagService — HNSW vector search over doctor's indexed documents (Layer 1).
 *
 * Uses LanceDB (embedded, pure JS) for vector storage and retrieval.
 * Embedding model: all-MiniLM-L6-v2 via ONNX Runtime (384-dim).
 */

export interface SearchResult {
  text: string;
  source: string;
  page: number;
  score: number;
  category: string | null;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private db: any = null;
  private table: any = null;
  private embedder: any = null;
  private initialized = false;

  /**
   * Initialize LanceDB connection and embedding model.
   * Called lazily on first search/index operation.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const lancedb = await import('@lancedb/lancedb');
      const dbPath = this.getDbPath();

      if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      }

      this.db = await lancedb.connect(dbPath);

      // Check if table exists
      const tables = await this.db.tableNames();
      if (tables.includes('knowledge_chunks')) {
        this.table = await this.db.openTable('knowledge_chunks');
      }

      this.initialized = true;
      this.logger.log('RAG engine initialized');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'RAG init failed';
      this.logger.warn(`RAG not available: ${message}. Layer 1 search disabled.`);
      this.initialized = true; // Don't retry — work without RAG
    }
  }

  /**
   * Search for relevant chunks using HNSW cosine similarity.
   * Returns top-K most similar chunks to the query.
   */
  async search(query: string, topK = 5, category?: string): Promise<SearchResult[]> {
    try {
      await this.ensureInitialized();

      if (!this.table) {
        // No documents indexed yet — return empty
        return [];
      }

      const queryVector = await this.embed(query);

      let searchQuery = this.table.search(queryVector).limit(topK);

      if (category) {
        searchQuery = searchQuery.where(`category = '${category}'`);
      }

      const results = await searchQuery.execute();

      return results.map((r: any) => ({
        text: r.text,
        source: r.source,
        page: r.page,
        score: r._distance ? 1 - r._distance : 0, // Convert distance to similarity
        category: r.category,
      }));
    } catch (err) {
      // Graceful degradation — no results, never crash
      const message = err instanceof Error ? err.message : 'Search failed';
      this.logger.warn(`RAG search skipped: ${message}`);
      return [];
    }
  }

  /**
   * Add chunks to the vector database.
   * Called by IndexerService after parsing a document.
   */
  async addChunks(chunks: {
    id: string;
    text: string;
    source: string;
    page: number;
    category: string | null;
  }[]): Promise<number> {
    await this.ensureInitialized();

    try {
      const records = await Promise.all(
        chunks.map(async (chunk) => ({
          id: chunk.id,
          vector: await this.embed(chunk.text),
          text: chunk.text,
          source: chunk.source,
          page: chunk.page,
          category: chunk.category || 'general',
          indexedAt: new Date().toISOString(),
        })),
      );

      if (!this.table) {
        this.table = await this.db.createTable('knowledge_chunks', records);
      } else {
        await this.table.add(records);
      }

      this.logger.log(`Indexed ${records.length} chunks from "${chunks[0]?.source}"`);
      return records.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Indexing failed';
      this.logger.error(`RAG indexing error: ${message}`);
      throw new RagIndexingError(message);
    }
  }

  /**
   * Remove all chunks for a specific source document.
   */
  async removeBySource(source: string): Promise<void> {
    if (!this.table) return;

    try {
      await this.table.delete(`source = '${source}'`);
      this.logger.log(`Removed chunks for: ${source}`);
    } catch (err) {
      this.logger.error(`Failed to remove chunks for ${source}: ${err}`);
    }
  }

  /**
   * Get total count of indexed chunks.
   */
  async getChunkCount(): Promise<number> {
    if (!this.table) return 0;
    try {
      const count = await this.table.countRows();
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Embed text into a 384-dimension vector using all-MiniLM-L6-v2.
   */
  private async embed(text: string): Promise<number[]> {
    if (!this.embedder) {
      await this.loadEmbedder();
    }
    return this.embedder.embed(text);
  }

  /**
   * Load the ONNX embedding model.
   * Falls back to a simple TF-IDF hash if ONNX is not available.
   */
  private async loadEmbedder(): Promise<void> {
    try {
      // Try ONNX-based embedder
      const { pipeline } = await import('@xenova/transformers');
      const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.embedder = {
        embed: async (text: string): Promise<number[]> => {
          const output = await pipe(text, { pooling: 'mean', normalize: true });
          return Array.from(output.data as Float32Array);
        },
      };
      this.logger.log('Embedding model loaded (all-MiniLM-L6-v2)');
    } catch (err) {
      // Fallback: simple hash-based pseudo-embeddings (for development/testing)
      this.logger.warn('ONNX embedder not available, using hash fallback');
      this.embedder = {
        embed: async (text: string): Promise<number[]> => {
          const { createHash } = await import('crypto');
          const hash = createHash('sha256').update(text).digest();
          const vector = new Array(384).fill(0);
          for (let i = 0; i < Math.min(hash.length, 384); i++) {
            vector[i] = (hash[i % hash.length] - 128) / 128;
          }
          return vector;
        },
      };
    }
  }

  private getDbPath(): string {
    const dataDir = process.env.DB_PATH
      ? path.dirname(process.env.DB_PATH)
      : process.cwd();
    return path.join(dataDir, 'amira-vectors');
  }
}

// ── Custom errors ────────────────────────────────────────────────────────────

export class RagNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RagNotAvailableError';
  }
}

export class RagIndexingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RagIndexingError';
  }
}
