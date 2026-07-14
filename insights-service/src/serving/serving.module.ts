import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ZoneInsight, ZoneInsightSchema } from '../schemas/zone-insight.schema';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ServingService } from './serving.service';
import { ServingController } from './serving.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ZoneInsight.name, schema: ZoneInsightSchema },
    ]),
    PipelineModule,
  ],
  providers: [ServingService],
  controllers: [ServingController],
})
export class ServingModule {}
