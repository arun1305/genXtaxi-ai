import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiCallLog, AiCallLogSchema } from '../schemas/ai-call-log.schema';
import { CostService } from './cost.service';
import { PricingService } from './pricing.service';
import { CostController } from './cost.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiCallLog.name, schema: AiCallLogSchema },
    ]),
  ],
  providers: [CostService, PricingService],
  controllers: [CostController],
  exports: [PricingService],
})
export class CostModule {}
