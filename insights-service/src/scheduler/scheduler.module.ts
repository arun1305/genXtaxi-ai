import { Module } from '@nestjs/common';
import { IngestModule } from '../ingest/ingest.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [IngestModule, PipelineModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
