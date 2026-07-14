import { Module } from '@nestjs/common';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { EscalationModule } from '../escalation/escalation.module';
import { GatewayClientModule } from '../gateway-client/gateway-client.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [OrchestratorModule, EscalationModule, GatewayClientModule],
  controllers: [AdminController],
})
export class AdminModule {}
