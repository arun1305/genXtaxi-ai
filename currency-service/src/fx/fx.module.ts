import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FxRate, FxRateSchema } from '../schemas/fx-rate.schema';
import { FxProviderAdapter } from './fx-provider.adapter';
import { FxService } from './fx.service';
import { FxScheduler } from './fx.scheduler';
import { FxController } from './fx.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FxRate.name, schema: FxRateSchema }]),
  ],
  providers: [FxProviderAdapter, FxService, FxScheduler],
  controllers: [FxController],
  exports: [FxService],
})
export class FxModule {}
