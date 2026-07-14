import { Module } from '@nestjs/common';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { EscalationModule } from '../escalation/escalation.module';
import { ChatController } from './chat.controller';

@Module({
  imports: [OrchestratorModule, EscalationModule],
  controllers: [ChatController],
})
export class ChatModule {}
