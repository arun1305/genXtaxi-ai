import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RideReadModel, RideReadSchema } from './ride.readmodel';
import { Review, ReviewSchema } from '../schemas/review.schema';
import {
  IngestWatermark,
  IngestWatermarkSchema,
} from '../schemas/ingest-watermark.schema';
import { ContentFilterService } from '../pipeline/content-filter.service';
import { MongoReviewSource } from './mongo-review.source';
import { REVIEW_SOURCE } from './review-source';
import { IngestService } from './ingest.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RideReadModel.name, schema: RideReadSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: IngestWatermark.name, schema: IngestWatermarkSchema },
    ]),
  ],
  providers: [
    ContentFilterService,
    MongoReviewSource,
    { provide: REVIEW_SOURCE, useExisting: MongoReviewSource },
    IngestService,
  ],
  exports: [IngestService, MongooseModule],
})
export class IngestModule {}
