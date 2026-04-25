import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { QueueService } from './queue.service';
import { QueueSseService } from './queue.sse.service';
import { CabinetService } from '../common/services/cabinet.service';

@Controller('queue')
export class QueueController {
  constructor(
    private service: QueueService,
    private sse: QueueSseService,
    private cabinetService: CabinetService,
  ) {}

  // ── Public endpoints (no JWT — patient on WiFi) ────────────────────────

  @Post('join')
  join(@Body() body: { patientName: string; patientId?: string; deviceHint?: string }) {
    return this.service.join(body as any);
  }

  @Get(':tokenId/status')
  getStatus(@Param('tokenId') tokenId: string) {
    return this.service.getStatus(tokenId);
  }

  @Sse(':tokenId/stream')
  stream(@Param('tokenId') tokenId: string): Observable<MessageEvent> {
    return this.sse.subscribe(tokenId);
  }

  /** SSE stream for TV display — all events for this cabinet */
  @Sse('display/stream')
  displayStream(): Observable<MessageEvent> {
    const cabinetId = this.cabinetService.getCabinetId();
    return this.sse.subscribeAll(cabinetId);
  }

  // ── Staff endpoints (JWT required) ─────────────────────────────────────

  @Post('checkin')
  @UseGuards(JwtAuthGuard)
  checkin(@CurrentUser() user: User, @Body() body: { rdvId: string }) {
    return this.service.checkin(body.rdvId, user.cabinetId);
  }

  @Patch('next')
  @UseGuards(JwtAuthGuard)
  callNext(@CurrentUser() user: User) {
    return this.service.callNext(user.cabinetId);
  }

  @Patch(':tokenId/done')
  @UseGuards(JwtAuthGuard)
  markDone(@Param('tokenId') tokenId: string, @CurrentUser() user: User) {
    return this.service.markDone(tokenId, user.cabinetId);
  }

  @Patch(':tokenId/absent')
  @UseGuards(JwtAuthGuard)
  markAbsent(@Param('tokenId') tokenId: string, @CurrentUser() user: User) {
    return this.service.markAbsent(tokenId, user.cabinetId);
  }

  @Patch(':tokenId/manual')
  @UseGuards(JwtAuthGuard)
  manualCall(@Param('tokenId') tokenId: string, @CurrentUser() user: User) {
    return this.service.manualCall(tokenId, user.cabinetId);
  }

  @Get('secretary')
  @UseGuards(JwtAuthGuard)
  secretaryView(@CurrentUser() user: User) {
    return this.service.secretaryView(user.cabinetId);
  }

  @Get('pending-checkin')
  @UseGuards(JwtAuthGuard)
  pendingCheckin(@CurrentUser() user: User) {
    return this.service.pendingCheckin(user.cabinetId);
  }
}
