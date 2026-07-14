import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@genxtaxi/ai-shared';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { ServingService } from './serving.service';
import { SummarizerService } from '../pipeline/summarizer.service';

/** Serving APIs (spec §3.6). */
@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1')
export class ServingController {
  constructor(
    private readonly serving: ServingService,
    private readonly summarizer: SummarizerService,
  ) {}

  @Get('reviews/drivers/:id/summary')
  @ApiOperation({ summary: 'Cached rider-facing driver reputation summary' })
  driverSummary(@Param('id') id: string, @Query('lang') lang = 'fr') {
    return this.serving.riderView(id, lang);
  }

  @Get('reviews/me/insights')
  @Roles(Role.DRIVER)
  @ApiOperation({ summary: 'Driver self-view coaching insights (auth = driver)' })
  myInsights(@CurrentUser() user: AuthenticatedUser, @Query('lang') lang = 'fr') {
    return this.serving.driverSelfView(user.userId, lang);
  }

  @Get('admin/insights/zones')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Aggregated admin zone analytics for a week' })
  zones(@Query('week') week: string) {
    return this.serving.zoneInsights(week);
  }

  @Post('admin/insights/recompute/:driverId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Force-refresh a driver summary' })
  recompute(@Param('driverId') driverId: string, @Query('lang') lang = 'fr') {
    return this.summarizer.recompute(driverId, lang);
  }
}
