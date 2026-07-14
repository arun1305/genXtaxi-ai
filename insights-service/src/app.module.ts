import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, AppEnv } from './config/env.validation';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/auth';
import { IngestModule } from './ingest/ingest.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ServingModule } from './serving/serving.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: { autoLogging: true, redact: ['req.headers.authorization'] },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
      }),
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    CommonModule,
    IngestModule,
    PipelineModule,
    SchedulerModule,
    ServingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
