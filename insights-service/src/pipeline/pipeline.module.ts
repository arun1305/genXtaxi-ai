import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from '../schemas/review.schema';
import {
  DriverSummary,
  DriverSummarySchema,
} from '../schemas/driver-summary.schema';
import { ZoneInsight, ZoneInsightSchema } from '../schemas/zone-insight.schema';
import { GatewayClientModule } from '../gateway-client/gateway-client.module';
import { AspectExtractionService } from './aspect-extraction.service';
import { SummarizerService } from './summarizer.service';
import { ZoneAggregationService } from './zone-aggregation.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: DriverSummary.name, schema: DriverSummarySchema },
      { name: ZoneInsight.name, schema: ZoneInsightSchema },
    ]),
    GatewayClientModule,
  ],
  providers: [AspectExtractionService, SummarizerService, ZoneAggregationService],
  exports: [
    AspectExtractionService,
    SummarizerService,
    ZoneAggregationService,
    MongooseModule,
  ],
})
export class PipelineModule {}
