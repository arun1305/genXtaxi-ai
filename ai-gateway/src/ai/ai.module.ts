import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { BudgetModule } from '../budget/budget.module';
import { RedactionModule } from '../redaction/redaction.module';
import { ObservabilityModule } from '../observability/observability.module';
import { CostModule } from '../cost/cost.module';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  imports: [
    ProvidersModule,
    BudgetModule,
    RedactionModule,
    ObservabilityModule,
    CostModule,
  ],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
