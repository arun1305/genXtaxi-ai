import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@genxtaxi/ai-shared';
import { FxService } from './fx.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@ApiTags('fx')
@Controller('api/v1/fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get('rates')
  @ApiOperation({ summary: 'Get a base->quote FX rate (cache-first)' })
  @ApiQuery({ name: 'base', example: 'DZD' })
  @ApiQuery({ name: 'quote', example: 'EUR' })
  getRate(@Query('base') base: string, @Query('quote') quote: string) {
    return this.fx.getRate(base, quote);
  }

  @Post('refresh')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Force an FX rate refresh (admin)' })
  async refresh() {
    const count = await this.fx.refreshAll();
    return { refreshed: count };
  }
}
