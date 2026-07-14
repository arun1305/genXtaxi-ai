import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SupportTicket,
  SupportTicketSchema,
} from '../schemas/support-ticket.schema';
import {
  RefundRequest,
  RefundRequestSchema,
} from '../schemas/refund-request.schema';
import { GatewayClientModule } from '../gateway-client/gateway-client.module';
import { ToolExecutorService } from './tool-executor.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: RefundRequest.name, schema: RefundRequestSchema },
    ]),
    GatewayClientModule,
  ],
  providers: [ToolExecutorService],
  exports: [ToolExecutorService, MongooseModule],
})
export class ToolsModule {}
