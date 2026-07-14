import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DemandController } from './demand.controller';

@Module({
  imports: [ConfigModule],
  controllers: [DemandController],
})
export class DemandModule {}
