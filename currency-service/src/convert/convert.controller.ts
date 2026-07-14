import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConvertService } from './convert.service';
import { ConvertDto } from './dto/convert.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

@ApiTags('convert')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/convert')
export class ConvertController {
  constructor(private readonly service: ConvertService) {}

  @Post()
  @ApiOperation({
    summary: 'Convert money for display (authoritative amount unchanged)',
  })
  convert(@Body() dto: ConvertDto) {
    return this.service.convert(dto.amount, dto.currency, dto.target);
  }
}
