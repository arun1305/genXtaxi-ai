import { Injectable } from '@nestjs/common';
import {
  InjectMetric,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

/** Prometheus metric providers exposed at /metrics (spec §6). */
export const metricProviders = [
  makeCounterProvider({
    name: 'ai_requests_total',
    help: 'Total AI calls routed through the gateway',
    labelNames: ['feature', 'model', 'outcome'],
  }),
  makeCounterProvider({
    name: 'ai_tokens_total',
    help: 'Total tokens consumed',
    labelNames: ['feature', 'model', 'direction'],
  }),
  makeCounterProvider({
    name: 'ai_cost_usd_micros_total',
    help: 'Total AI cost in USD micros (integer, base reporting currency)',
    labelNames: ['feature', 'model'],
  }),
  makeHistogramProvider({
    name: 'ai_latency_ms',
    help: 'AI call latency in milliseconds',
    labelNames: ['feature', 'model'],
    buckets: [100, 250, 500, 1000, 1500, 2500, 4000, 8000, 15000],
  }),
];

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('ai_requests_total') private readonly requests: Counter<string>,
    @InjectMetric('ai_tokens_total') private readonly tokens: Counter<string>,
    @InjectMetric('ai_cost_usd_micros_total')
    private readonly cost: Counter<string>,
    @InjectMetric('ai_latency_ms') private readonly latency: Histogram<string>,
  ) {}

  record(params: {
    feature: string;
    model: string;
    outcome: string;
    inputTokens: number;
    outputTokens: number;
    costUsdMicros: number;
    latencyMs: number;
  }): void {
    const { feature, model, outcome } = params;
    this.requests.inc({ feature, model, outcome });
    this.tokens.inc({ feature, model, direction: 'input' }, params.inputTokens);
    this.tokens.inc({ feature, model, direction: 'output' }, params.outputTokens);
    this.cost.inc({ feature, model }, params.costUsdMicros);
    this.latency.observe({ feature, model }, params.latencyMs);
  }
}
