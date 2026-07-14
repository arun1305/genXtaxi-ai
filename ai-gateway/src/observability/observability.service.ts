import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Money } from '@genxtaxi/ai-shared';
import { AiCallLog, AiCallLogDocument } from '../schemas/ai-call-log.schema';
import { MetricsService } from './metrics.service';

export interface AiCallRecord {
  traceId: string;
  userId?: string;
  role?: string;
  feature: string;
  model: string;
  promptVersion?: string;
  inputTokens: number;
  outputTokens: number;
  cost?: Money;
  costUsdMicros?: number;
  latencyMs: number;
  toolCalls?: string[];
  outcome: string;
}

/**
 * Single sink for AI-call observability (spec §1 Observability, §6). Writes the
 * durable ai_call_logs record AND the Prometheus counters/histograms.
 */
@Injectable()
export class ObservabilityService {
  constructor(
    @InjectModel(AiCallLog.name)
    private readonly model: Model<AiCallLogDocument>,
    private readonly metrics: MetricsService,
  ) {}

  async record(rec: AiCallRecord): Promise<void> {
    await this.model.create({
      traceId: rec.traceId,
      userId: rec.userId,
      role: rec.role,
      feature: rec.feature,
      model: rec.model,
      promptVersion: rec.promptVersion,
      inputTokens: rec.inputTokens,
      outputTokens: rec.outputTokens,
      cost: rec.cost,
      latencyMs: rec.latencyMs,
      toolCalls: rec.toolCalls ?? [],
      outcome: rec.outcome,
    });

    this.metrics.record({
      feature: rec.feature,
      model: rec.model,
      outcome: rec.outcome,
      inputTokens: rec.inputTokens,
      outputTokens: rec.outputTokens,
      costUsdMicros: rec.costUsdMicros ?? 0,
      latencyMs: rec.latencyMs,
    });
  }
}
