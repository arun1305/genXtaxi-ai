import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsString, Length } from 'class-validator';
import { Role } from '@genxtaxi/ai-shared';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

class NormalizeDto {
  @IsInt() amount!: number;
  @IsString() @Length(3, 3) currency!: string;
}

@ApiTags('reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api/v1/reporting')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Post('normalize')
  @ApiOperation({ summary: 'Normalize an amount to the base reporting currency' })
  normalize(@Body() dto: NormalizeDto) {
    return this.service.normalize(dto.amount, dto.currency);
  }
}
