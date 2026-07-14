import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '@genxtaxi/ai-shared';
import { AiService } from './ai.service';
import { CompleteDto, EmbedDto } from './dto/ai.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TraceId } from '../common/decorators/trace.decorator';

/**
 * Internal AI entrypoint (spec §1). Later phases (chat-orchestrator, insights)
 * call these; keeps all provider access, budgets and logging in one place.
 */
@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Post('complete')
  @ApiOperation({ summary: 'Route an LLM completion through the gateway' })
  complete(
    @Body() dto: CompleteDto,
    @CurrentUser() user: AuthenticatedUser,
    @TraceId() traceId: string,
  ) {
    return this.service.complete(
      {
        task: dto.task,
        messages: dto.messages,
        feature: dto.feature,
        responseFormat: dto.responseFormat,
        tools: dto.tools,
      },
      user,
      traceId,
    );
  }

  @Post('embed')
  @ApiOperation({ summary: 'Produce 1024-dim embeddings through the gateway' })
  embed(
    @Body() dto: EmbedDto,
    @CurrentUser() user: AuthenticatedUser,
    @TraceId() traceId: string,
  ) {
    return this.service.embed(dto.texts, user, traceId);
  }
}
