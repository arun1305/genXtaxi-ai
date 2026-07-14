import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiTask, Role } from '@genxtaxi/ai-shared';
import { ChatUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { EscalationService } from '../escalation/escalation.service';
import { SessionsService } from '../orchestrator/sessions.service';
import { AiGatewayClient } from '../gateway-client/ai-gateway.client';
import { TicketStatus } from '../schemas/support-ticket.schema';

/**
 * Admin live-handoff inbox (spec §2.3): escalated conversations with full
 * transcript + a model-suggested reply draft, plus assign/resolve.
 */
@ApiTags('admin-inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api/v1/admin/chat')
export class AdminController {
  constructor(
    private readonly escalation: EscalationService,
    private readonly sessions: SessionsService,
    private readonly gateway: AiGatewayClient,
  ) {}

  @Get('inbox')
  @ApiOperation({ summary: 'List escalated conversations (handoff inbox)' })
  inbox(@Query('status') status?: TicketStatus, @Query('category') category?: string) {
    return this.escalation.listInbox({ status, category });
  }

  @Get('sessions/:id/transcript')
  @ApiOperation({ summary: 'Full transcript for an escalated session' })
  transcript(@Param('id') id: string) {
    return this.sessions.transcript(id);
  }

  @Post('tickets/:id/assign')
  @ApiOperation({ summary: 'Assign a ticket to the current agent' })
  assign(@Param('id') id: string, @CurrentUser() user: ChatUser) {
    return this.escalation.assign(id, user.userId);
  }

  @Post('tickets/:id/resolve')
  @ApiOperation({ summary: 'Resolve a ticket (optional CSAT)' })
  resolve(@Param('id') id: string, @Body('csatScore') csatScore?: number) {
    return this.escalation.resolve(id, csatScore);
  }

  @Get('sessions/:id/suggested-reply')
  @ApiOperation({ summary: 'Model-suggested reply draft for the agent (spec §2.3)' })
  async suggestedReply(@Param('id') id: string, @CurrentUser() user: ChatUser) {
    const transcript = await this.sessions.transcript(id);
    const convo = transcript
      .filter((m) => m.sender === 'user' || m.sender === 'assistant')
      .map((m) => `${m.sender}: ${m.content}`)
      .join('\n');
    const completion = await this.gateway.complete(user.token, {
      task: AiTask.CHAT,
      feature: 'chatbot_agent_draft',
      messages: [
        {
          role: 'system',
          content:
            'You draft a concise, empathetic reply for a HUMAN support agent to review before sending. Do not invent prices or policy.',
        },
        { role: 'user', content: `Conversation so far:\n${convo}\n\nDraft the agent's next reply:` },
      ],
    });
    return { draft: completion.content };
  }
}
