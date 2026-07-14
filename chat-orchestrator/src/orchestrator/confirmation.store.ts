import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { AppEnv } from '../config/env.validation';
import { REDIS_CLIENT } from '../redis/redis.module';
import { PendingAction } from '../tools/tool.types';

/**
 * Stores pending confirmation actions (spec §2.2) in Redis with a TTL so a
 * user's Confirm/Decline maps back to the exact deferred commit. Scoped by
 * session so one user cannot confirm another's action.
 */
@Injectable()
export class ConfirmationStore {
  private readonly ttl: number;

  constructor(
    config: ConfigService<AppEnv, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.ttl = config.get('CONFIRM_TTL_SECONDS', { infer: true });
  }

  private key(sessionId: string, toolCallId: string): string {
    return `confirm:${sessionId}:${toolCallId}`;
  }

  async save(sessionId: string, toolCallId: string, action: PendingAction): Promise<void> {
    await this.redis.set(
      this.key(sessionId, toolCallId),
      JSON.stringify(action),
      'EX',
      this.ttl,
    );
  }

  async take(sessionId: string, toolCallId: string): Promise<PendingAction | null> {
    const key = this.key(sessionId, toolCallId);
    const raw = await this.redis.get(key);
    if (!raw) return null;
    await this.redis.del(key); // single-use — prevents replay/double-confirm
    return JSON.parse(raw) as PendingAction;
  }
}
