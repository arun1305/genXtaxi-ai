import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SupportTicket,
  SupportTicketSchema,
} from '../schemas/support-ticket.schema';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { EscalationService } from './escalation.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicket.name, schema: SupportTicketSchema },
    ]),
    OrchestratorModule,
  ],
  providers: [EscalationService],
  exports: [EscalationService],
})
export class EscalationModule {}
