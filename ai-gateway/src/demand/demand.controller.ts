import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@genxtaxi/ai-shared';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppEnv } from '../config/env.validation';

/**
 * Proxies demand/heatmap + surge from the Python demand-service (spec §4.3:
 * "Node consumes via ai-gateway"). Forwards the caller's JWT so role scoping and
 * observability stay consistent. Surge is ADVISORY this phase.
 */
@ApiTags('demand')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/demand')
export class DemandController {
  private readonly baseUrl: string;

  constructor(config: ConfigService<AppEnv, true>) {
    // Reuses an env var; defaults to the local demand-service.
    this.baseUrl = process.env.DEMAND_SERVICE_URL ?? 'http://localhost:8084';
  }

  @Get('heatmap')
  @Roles(Role.DRIVER, Role.ADMIN)
  @ApiOperation({ summary: 'Driver demand heatmap (H3 hexes: predicted + surge)' })
  heatmap(
    @Query('city') city = 'default',
    @Query('bbox') bbox = '',
    @Req() req: { headers: Record<string, string> },
  ) {
    return this.forward(`/api/v1/demand/heatmap?city=${city}&bbox=${encodeURIComponent(bbox)}`, req);
  }

  @Get('surge')
  @Roles(Role.PASSENGER, Role.DRIVER, Role.ADMIN)
  @ApiOperation({ summary: 'Advisory surge multiplier for a hex (rider indicator)' })
  surge(
    @Query('hex') hex: string,
    @Query('city') city = 'default',
    @Req() req: { headers: Record<string, string> },
  ) {
    return this.forward(`/api/v1/demand/surge?hex=${hex}&city=${city}`, req);
  }

  private async forward(path: string, req: { headers: Record<string, string> }) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { authorization: req.headers['authorization'] ?? '' },
    });
    return res.json();
  }
}
