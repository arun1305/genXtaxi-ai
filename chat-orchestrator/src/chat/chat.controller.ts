import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChatUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { SessionsService } from '../orchestrator/sessions.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import {
  ConfirmDto,
  CreateSessionDto,
  EscalateDto,
  SendMessageDto,
} from './dto/chat.dto';
import { EscalationService } from '../escalation/escalation.service';

/**
 * Chatbot HTTP surface (spec §2.7). Messages stream Server-Sent Events with the
 * spec event types: token, tool_call_proposed, tool_result, action_card, done, error.
 */
@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/chat/sessions')
export class ChatController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly orchestrator: OrchestratorService,
    private readonly escalation: EscalationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a chat session' })
  async create(@Body() dto: CreateSessionDto, @CurrentUser() user: ChatUser) {
    const session = await this.sessions.create({
      userId: user.userId,
      role: user.role,
      lang: dto.lang ?? user.preferredLang ?? 'fr',
      topic: dto.topic,
    });
    return { sessionId: session.id };
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message; streams SSE tokens + tool events' })
  async message(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: ChatUser,
    @Req() req: { headers: Record<string, string> },
    @Res() res: Response,
  ) {
    const session = await this.sessions.get(id, user.userId);
    const traceId = req.headers['x-trace-id'] ?? uuidv4();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('x-trace-id', traceId);
    res.flushHeaders?.();

    const write = (event: unknown) => {
      const e = event as { type: string };
      res.write(`event: ${e.type}\n`);
      res.write(`data: ${JSON.stringify((event as { data: unknown }).data)}\n\n`);
    };

    try {
      for await (const ev of this.orchestrator.processMessage(session, user, dto.content, traceId)) {
        write(ev);
      }
    } catch (err) {
      write({ type: 'error', data: { message: (err as Error).message } });
    } finally {
      res.end();
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Full transcript' })
  async transcript(@Param('id') id: string, @CurrentUser() user: ChatUser) {
    await this.sessions.get(id, user.userId);
    const messages = await this.sessions.transcript(id);
    return { sessionId: id, messages };
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm or decline a pending action card' })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmDto,
    @CurrentUser() user: ChatUser,
    @Req() req: { headers: Record<string, string> },
  ) {
    const session = await this.sessions.get(id, user.userId);
    const traceId = req.headers['x-trace-id'] ?? uuidv4();
    return this.orchestrator.confirm(session, user, dto.toolCallId, dto.decision, traceId);
  }

  @Post(':id/escalate')
  @ApiOperation({ summary: 'Escalate to a human agent' })
  async escalate(
    @Param('id') id: string,
    @Body() dto: EscalateDto,
    @CurrentUser() user: ChatUser,
  ) {
    const session = await this.sessions.get(id, user.userId);
    const ticket = await this.escalation.createTicket({
      sessionId: id,
      userId: user.userId,
      summary: dto.summary,
      priority: dto.priority ?? 'normal',
      category: 'question',
    });
    return { ticketId: ticket.id };
  }
}
