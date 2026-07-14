import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppEnv } from '../config/env.validation';
import { IngestService } from '../ingest/ingest.service';
import { AspectExtractionService } from '../pipeline/aspect-extraction.service';
import { SummarizerService } from '../pipeline/summarizer.service';
import { ZoneAggregationService } from '../pipeline/zone-aggregation.service';

/**
 * Batch orchestration (spec §3.2): summaries are precomputed, never on the read
 * path. Ingest+aspects+summary run on INGEST_CRON; zone aggregation nightly.
 * Jobs are guarded so overlapping runs don't stack.
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly registry: SchedulerRegistry,
    private readonly ingest: IngestService,
    private readonly aspects: AspectExtractionService,
    private readonly summarizer: SummarizerService,
    private readonly zones: ZoneAggregationService,
  ) {}

  onModuleInit(): void {
    this.addJob('insights-ingest', this.config.get('INGEST_CRON', { infer: true }), () =>
      this.runIngestCycle(),
    );
    this.addJob('insights-zones', this.config.get('ZONE_AGGREGATION_CRON', { infer: true }), () =>
      this.safe('zone-aggregation', () => this.zones.aggregateCurrentWeek()),
    );
  }

  private addJob(name: string, cron: string, fn: () => Promise<void>): void {
    const job = new CronJob(cron, fn);
    this.registry.addCronJob(name, job);
    job.start();
    this.logger.log(`Scheduled ${name}: "${cron}"`);
  }

  /** Ingest -> aspect extraction -> refresh due driver summaries (spec §3.2/3.3). */
  async runIngestCycle(): Promise<void> {
    if (this.running) {
      this.logger.warn('Ingest cycle already running — skipping this tick');
      return;
    }
    this.running = true;
    try {
      await this.ingest.ingestBatch();
      await this.aspects.processPending();

      const minNew = this.config.get('SUMMARY_MIN_NEW_REVIEWS', { infer: true });
      const maxAge = this.config.get('SUMMARY_MAX_AGE_HOURS', { infer: true });
      const lang = this.config.get('DEFAULT_LANG', { infer: true });
      const due = await this.summarizer.driversNeedingRefresh(minNew, maxAge);
      for (const driverId of due) {
        await this.summarizer.recompute(driverId, lang).catch((e) =>
          this.logger.error(`recompute ${driverId} failed: ${e.message}`),
        );
      }
      if (due.length) this.logger.log(`Refreshed ${due.length} driver summaries`);
    } catch (err) {
      this.logger.error(`Ingest cycle failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async safe(label: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`${label} failed: ${(err as Error).message}`);
    }
  }
}
