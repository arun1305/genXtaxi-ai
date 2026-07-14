import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { BudgetExceededError } from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Hard per-user daily token budget (spec §1 Cost controls, §5). Uses an atomic
 * Redis counter with a 24h TTL keyed by user + UTC day.
 */
@Injectable()
export class BudgetService {
  private readonly limit: number;

  constructor(
    config: ConfigService<AppEnv, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.limit = config.get('DAILY_TOKEN_BUDGET_PER_USER', { infer: true });
  }

  private key(userId: string): string {
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    return `budget:${userId}:${day}`;
  }

  /** Throw if the user is already over budget (checked pre-call). */
  async assertWithinBudget(userId: string): Promise<void> {
    const used = Number((await this.redis.get(this.key(userId))) ?? 0);
    if (used >= this.limit) {
      throw new BudgetExceededError(userId, this.limit);
    }
  }

  /** Record token consumption after a call; sets TTL on first write of the day. */
  async consume(userId: string, tokens: number): Promise<number> {
    const key = this.key(userId);
    const total = await this.redis.incrby(key, Math.max(0, Math.round(tokens)));
    if (total === tokens) {
      await this.redis.expire(key, 60 * 60 * 24);
    }
    return total;
  }

  async remaining(userId: string): Promise<number> {
    const used = Number((await this.redis.get(this.key(userId))) ?? 0);
    return Math.max(0, this.limit - used);
  }
}
