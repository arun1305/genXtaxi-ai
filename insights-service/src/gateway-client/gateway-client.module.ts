import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiGatewayClient } from './ai-gateway.client';

@Module({
  imports: [ConfigModule],
  providers: [AiGatewayClient],
  exports: [AiGatewayClient],
})
export class GatewayClientModule {}
