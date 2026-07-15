import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppEnv } from '../config/env.validation';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) =>
        new Redis(config.getOrThrow('REDIS_URL'), {
          maxRetriesPerRequest: 3,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
