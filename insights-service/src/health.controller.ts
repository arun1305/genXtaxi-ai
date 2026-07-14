import { Controller, Get, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis/redis.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const redisOk = await this.redis.ping().then((r) => r === 'PONG').catch(() => false);
    return {
      status: this.mongo.readyState === 1 && redisOk ? 'ok' : 'degraded',
      service: 'insights-service',
      dependencies: { mongodb: this.mongo.readyState === 1, redis: redisOk },
      time: new Date().toISOString(),
    };
  }
}
