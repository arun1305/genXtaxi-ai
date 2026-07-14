import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import { validateEnv, AppEnv } from './config/env.validation';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { ProvidersModule } from './providers/providers.module';
import { BudgetModule } from './budget/budget.module';
import { RedactionModule } from './redaction/redaction.module';
import { ObservabilityModule } from './observability/observability.module';
import { CostModule } from './cost/cost.module';
import { PromptsModule } from './prompts/prompts.module';
import { RagModule } from './rag/rag.module';
import { AiModule } from './ai/ai.module';
import { DemandModule } from './demand/demand.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TraceInterceptor } from './common/interceptors/trace.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => (req.headers['x-trace-id'] as string) ?? uuidv4(),
        autoLogging: true,
        // Never log Authorization or raw bodies that may hold PII.
        redact: ['req.headers.authorization', 'req.body'],
      },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => [
        {
          ttl: config.get('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    AuthModule,
    HealthModule,
    ProvidersModule,
    BudgetModule,
    RedactionModule,
    ObservabilityModule,
    CostModule,
    PromptsModule,
    RagModule,
    AiModule,
    DemandModule,
  ],
  providers: [
    // Global guards: JWT first, then RBAC, then rate-limit.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TraceInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
