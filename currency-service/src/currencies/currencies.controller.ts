import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@genxtaxi/ai-shared';
import { CurrenciesService } from './currencies.service';
import { UpsertCurrencyDto } from './dto/currency.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@ApiTags('currencies')
@Controller('api/v1/currencies')
export class CurrenciesController {
  constructor(private readonly service: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'List supported currencies' })
  list(@Query('includeDisabled') includeDisabled?: string) {
    return this.service.findAll(includeDisabled === 'true');
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create or update a currency (admin)' })
  upsert(@Body() dto: UpsertCurrencyDto) {
    return this.service.upsert(dto);
  }
}
