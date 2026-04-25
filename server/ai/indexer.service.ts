import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { RagService } from './rag.service';

/**
 * IndexerService — Parses PDFs/DOCX/TXT, chunks text, indexes into LanceDB.
 *
 * Flow: file → parse → chunk (500 tokens, 50 overlap) → embed → store
 */

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const CHUNK_SIZE = 500; // tokens (roughly words)
const CHUNK_OVERLAP = 50;

export interface IndexProgress {
  fileName: string;
  totalChunks: number;
  indexedChunks: number;
  status: 'parsing' | 'chunking' | 'indexing' | 'done' | 'error';
  error?: string;
}

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);

  constructor(private readonly rag: RagService) {}

  /**
   * Index a document: parse → chunk → embed → store.
   * Returns the number of chunks indexed.
   */
  async indexDocument(
    filePath: string,
    category?: string,
    onProgress?: (progress: IndexProgress) => void,
  ): Promise<{ chunksIndexed: number; fileName: string }> {
    // ── Validate ──
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Type de fichier non supporté: ${ext}. Formats acceptés: PDF, DOCX, TXT.`,
      );
    }

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`Fichier introuvable: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Fichier trop volumineux (${Math.round(stats.size / 1024 / 1024)}MB). Maximum: 100MB.`,
      );
    }

    const fileName = path.basename(filePath);
    const report = (status: IndexProgress['status'], indexed = 0, total = 0, error?: string) => {
      onProgress?.({ fileName, totalChunks: total, indexedChunks: indexed, status, error });
    };

    try {
      // ── Parse ──
      report('parsing');
      const { text, pageCount } = await this.parseFile(filePath, ext);

      if (!text || text.trim().length < 50) {
        throw new BadRequestException('Le document ne contient pas assez de texte exploitable.');
      }

      // ── Chunk ──
      report('chunking');
      const chunks = this.chunkText(text, fileName, category || null);
      this.logger.log(`${fileName}: ${chunks.length} chunks from ${pageCount} pages`);

      // ── Remove old chunks for this file (re-index) ──
      await this.rag.removeBySource(fileName);

      // ── Index in batches ──
      report('indexing', 0, chunks.length);
      const batchSize = 50;
      let indexed = 0;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await this.rag.addChunks(batch);
        indexed += batch.length;
        report('indexing', indexed, chunks.length);
      }

      report('done', indexed, chunks.length);
      this.logger.log(`${fileName}: indexing complete (${indexed} chunks)`);

      return { chunksIndexed: indexed, fileName };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const message = err instanceof Error ? err.message : 'Indexing failed';
      report('error', 0, 0, message);
      this.logger.error(`Failed to index ${fileName}: ${message}`);
      throw new BadRequestException(`Erreur lors de l'indexation: ${message}`);
    }
  }

  /**
   * Parse a file into raw text.
   */
  private async parseFile(
    filePath: string,
    ext: string,
  ): Promise<{ text: string; pageCount: number }> {
    switch (ext) {
      case '.pdf':
        return this.parsePdf(filePath);
      case '.docx':
        return this.parseDocx(filePath);
      case '.txt':
        return this.parseTxt(filePath);
      default:
        throw new BadRequestException(`Format non supporté: ${ext}`);
    }
  }

  private async parsePdf(filePath: string): Promise<{ text: string; pageCount: number }> {
    try {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return { text: data.text, pageCount: data.numpages };
    } catch (err) {
      throw new BadRequestException('Impossible de lire le fichier PDF. Vérifiez qu\'il n\'est pas protégé.');
    }
  }

  private async parseDocx(filePath: string): Promise<{ text: string; pageCount: number }> {
    try {
      const mammoth = require('mammoth');
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      // DOCX doesn't have reliable page count
      const estimatedPages = Math.ceil(result.value.length / 3000);
      return { text: result.value, pageCount: estimatedPages };
    } catch (err) {
      throw new BadRequestException('Impossible de lire le fichier DOCX.');
    }
  }

  private async parseTxt(filePath: string): Promise<{ text: string; pageCount: number }> {
    const text = fs.readFileSync(filePath, 'utf-8');
    return { text, pageCount: 1 };
  }

  /**
   * Split text into overlapping chunks.
   * 500 words per chunk, 50 word overlap.
   */
  private chunkText(
    text: string,
    source: string,
    category: string | null,
  ): { id: string; text: string; source: string; page: number; category: string | null }[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const chunks: { id: string; text: string; source: string; page: number; category: string | null }[] = [];

    let position = 0;
    let chunkIndex = 0;

    while (position < words.length) {
      const end = Math.min(position + CHUNK_SIZE, words.length);
      const chunkWords = words.slice(position, end);
      const chunkText = chunkWords.join(' ');

      if (chunkText.trim().length > 20) {
        // Estimate page number (rough: ~300 words per page)
        const estimatedPage = Math.floor(position / 300) + 1;

        chunks.push({
          id: uuid(),
          text: chunkText,
          source,
          page: estimatedPage,
          category,
        });
        chunkIndex++;
      }

      position += CHUNK_SIZE - CHUNK_OVERLAP;
    }

    return chunks;
  }
}
