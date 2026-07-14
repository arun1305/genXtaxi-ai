import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, AppEnv } from './config/env.validation';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { FxModule } from './fx/fx.module';
import { ConvertModule } from './convert/convert.module';
import { ReportingModule } from './reporting/reporting.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        redact: ['req.headers.authorization'],
      },
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
    CurrenciesModule,
    FxModule,
    ConvertModule,
    ReportingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
