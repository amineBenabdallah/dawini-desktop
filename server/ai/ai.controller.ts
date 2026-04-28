import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiService, AmiraNotAvailableError, AmiraValidationError } from './ai.service';
import { IndexerService } from './indexer.service';
import { LlmService } from './llm.service';
import { RagService } from './rag.service';

/**
 * AiController — REST endpoints for Dr. Amira.
 *
 * POST /ai/query     → JSON response (always works)
 * POST /ai/stream    → SSE streaming (only when LLM loaded)
 * POST /ai/vitals    → Quick vital sign check
 * GET  /ai/status    → Is Amira loaded?
 * POST /ai/index     → Index a document
 * GET  /ai/library   → List indexed documents
 * DELETE /ai/library/:source → Remove indexed document
 */
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly indexer: IndexerService,
    private readonly llm: LlmService,
    private readonly rag: RagService,
  ) {}

  /**
   * Standard query — returns complete JSON response.
   * Works whether LLM is loaded or not (returns error message if not).
   */
  @Post('query')
  @HttpCode(HttpStatus.OK)
  async query(
    @Body() body: { screen: string; question: string; patientId?: string; consultationId?: string },
  ) {
    try {
      return await this.ai.query({
        screen: body.screen,
        question: body.question,
        patientId: body.patientId,
        consultationId: body.consultationId,
      });
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /**
   * SSE streaming — token-by-token response.
   * Only useful when LLM is loaded and generating.
   */
  @Post('stream')
  async stream(
    @Body() body: { screen: string; question: string; patientId?: string; consultationId?: string },
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.ai.stream({
        screen: body.screen,
        question: body.question,
        patientId: body.patientId,
        consultationId: body.consultationId,
      });

      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.done) break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      res.write(`data: ${JSON.stringify({ token: message, done: true, error: true })}\n\n`);
    } finally {
      res.end();
    }
  }

  /** Quick vital sign check — for whisper hints. */
  @Post('vitals')
  @HttpCode(HttpStatus.OK)
  async checkVitals(
    @Body() body: { ta?: string; poids?: number; temp?: number; patientId?: string },
  ) {
    try {
      const result = await this.ai.checkVitals(
        { ta: body.ta, poids: body.poids, temp: body.temp },
        body.patientId,
      );
      return { alert: result };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** Amira status — is the model loaded? */
  @Get('status')
  getStatus() {
    return this.ai.getStatus();
  }

  /** Re-check Ollama — useful when Ollama was started after Dawini launched. */
  @Post('reload')
  @HttpCode(HttpStatus.OK)
  async reloadModel() {
    await this.llm.checkOllama();
    return this.ai.getStatus();
  }

  /** Index a document (PDF/DOCX/TXT). */
  @Post('index')
  @HttpCode(HttpStatus.OK)
  async indexDocument(@Body() body: { filePath: string; category?: string }) {
    if (!body.filePath) {
      throw new BadRequestException('filePath est requis.');
    }
    try {
      return await this.indexer.indexDocument(body.filePath, body.category);
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** List indexed documents stats. */
  @Get('library')
  async getLibrary() {
    const chunkCount = await this.rag.getChunkCount();
    return { totalChunks: chunkCount };
  }

  /** Remove an indexed document by source name. */
  @Delete('library/:source')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDocument(@Param('source') source: string) {
    await this.rag.removeBySource(decodeURIComponent(source));
  }

  // ── Error mapping ──────────────────────────────────────────────────────

  private mapError(err: unknown): HttpException {
    if (err instanceof HttpException) return err;
    if (err instanceof AmiraNotAvailableError) {
      return new HttpException({ message: err.message, code: 'AMIRA_NOT_AVAILABLE' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (err instanceof AmiraValidationError) {
      return new BadRequestException(err.message);
    }
    const message = err instanceof Error ? err.message : 'Erreur interne Amira';
    return new HttpException({ message, code: 'AMIRA_ERROR' }, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
