import { Module } from '@nestjs/common';
import { CurrenciesModule } from '../currencies/currencies.module';
import { FxModule } from '../fx/fx.module';
import { ConvertService } from './convert.service';
import { ConvertController } from './convert.controller';

@Module({
  imports: [CurrenciesModule, FxModule],
  providers: [ConvertService],
  controllers: [ConvertController],
  exports: [ConvertService],
})
export class ConvertModule {}
