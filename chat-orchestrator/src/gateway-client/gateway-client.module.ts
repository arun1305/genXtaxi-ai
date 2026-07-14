import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiGatewayClient } from './ai-gateway.client';
import { CoreBackendClient } from './core-backend.client';

@Module({
  imports: [ConfigModule],
  providers: [AiGatewayClient, CoreBackendClient],
  exports: [AiGatewayClient, CoreBackendClient],
})
export class GatewayClientModule {}
