import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppEnv } from '../config/env.validation';
import { FxService } from './fx.service';

/**
 * Registers the FX refresh cron dynamically from FX_REFRESH_CRON (spec §1:
 * refreshed on a schedule). Also warms rates once on boot.
 */
@Injectable()
export class FxScheduler implements OnModuleInit {
  private readonly logger = new Logger(FxScheduler.name);

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly fx: FxService,
    private readonly registry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const cronExpr = this.config.get('FX_REFRESH_CRON', { infer: true });
    const job = new CronJob(cronExpr, () => this.safeRefresh());
    this.registry.addCronJob('fx-refresh', job);
    job.start();
    this.logger.log(`FX refresh scheduled: "${cronExpr}"`);
    await this.safeRefresh(); // warm on boot
  }

  private async safeRefresh(): Promise<void> {
    try {
      await this.fx.refreshAll();
    } catch (err) {
      // Never crash the service on a provider outage (spec §4.8 degrade gracefully).
      this.logger.error(`FX refresh failed: ${(err as Error).message}`);
    }
  }
}
