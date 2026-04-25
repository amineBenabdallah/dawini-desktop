/**
 * Schema for documents indexed in LanceDB (Layer 1).
 * Not a TypeORM entity — LanceDB has its own storage.
 */
export interface KnowledgeChunk {
  /** Auto-generated unique ID */
  id: string;

  /** 384-dimension embedding vector (all-MiniLM-L6-v2) */
  vector: number[];

  /** Raw text content of the chunk */
  text: string;

  /** Source document name (e.g., "Dorosz 2025.pdf") */
  source: string;

  /** Page number in the original document */
  page: number;

  /** Optional category for filtered search */
  category: string | null;

  /** When this chunk was indexed */
  indexedAt: string;
}

/**
 * Metadata for an indexed document (stored in SQLite for listing).
 */
export interface IndexedDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  pageCount: number;
  chunksCount: number;
  category: string | null;
  indexedAt: string;
}
