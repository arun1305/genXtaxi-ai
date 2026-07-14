import { Controller, Get, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import type Redis from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { REDIS_CLIENT } from '../redis/redis.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + dependency readiness probe' })
  async check() {
    const [mongoOk, redisOk] = await Promise.all([
      Promise.resolve(this.mongo.readyState === 1),
      this.redis
        .ping()
        .then((r) => r === 'PONG')
        .catch(() => false),
    ]);
    return {
      status: mongoOk && redisOk ? 'ok' : 'degraded',
      dependencies: { mongodb: mongoOk, redis: redisOk },
      service: 'ai-gateway',
      time: new Date().toISOString(),
    };
  }
}
