import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatSession, ChatSessionSchema } from '../schemas/chat-session.schema';
import { ChatMessage, ChatMessageSchema } from '../schemas/chat-message.schema';
import { GatewayClientModule } from '../gateway-client/gateway-client.module';
import { ToolsModule } from '../tools/tools.module';
import { SessionsService } from './sessions.service';
import { GroundingService } from './grounding.service';
import { ConfirmationStore } from './confirmation.store';
import { OrchestratorService } from './orchestrator.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
    GatewayClientModule,
    ToolsModule,
  ],
  providers: [
    SessionsService,
    GroundingService,
    ConfirmationStore,
    OrchestratorService,
  ],
  exports: [SessionsService, OrchestratorService, GroundingService],
})
export class OrchestratorModule {}
