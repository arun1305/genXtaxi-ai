import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppEnv } from '../config/env.validation';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Global Redis provider (spec §1: Redis is the low-latency online layer for
 * token budgets, FX cache, circuit-breaker state).
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => {
        const client = new Redis(config.get('REDIS_URL', { infer: true }), {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        });
        client.on('error', (err) =>
          // eslint-disable-next-line no-console
          console.error('[redis] connection error', err.message),
        );
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
