import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@genxtaxi/ai-shared';
import { CostService } from './cost.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('cost')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api/v1/admin/ai/cost')
export class CostController {
  constructor(private readonly service: CostService) {}

  @Get()
  @ApiOperation({ summary: 'Per-feature AI cost/observability summary (spec §6)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'feature', required: false })
  summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('feature') feature?: string,
  ) {
    return this.service.summary({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      feature,
    });
  }

  @Get('daily')
  @ApiOperation({ summary: 'Cost/day time-series for the dashboard chart' })
  daily(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('feature') feature?: string,
  ) {
    return this.service.daily({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      feature,
    });
  }
}
