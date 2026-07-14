import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AiCallLog, AiCallLogSchema } from '../schemas/ai-call-log.schema';
import { MetricsService, metricProviders } from './metrics.service';
import { ObservabilityService } from './observability.service';

/**
 * Observability module. Exposes GET /metrics (Prometheus) and provides the
 * ObservabilityService sink used by every feature.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiCallLog.name, schema: AiCallLogSchema },
    ]),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [...metricProviders, MetricsService, ObservabilityService],
  exports: [ObservabilityService, MetricsService],
})
export class ObservabilityModule {}
