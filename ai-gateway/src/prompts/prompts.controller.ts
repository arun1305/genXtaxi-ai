import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@genxtaxi/ai-shared';
import { PromptsService } from './prompts.service';
import { CreatePromptDto, PreviewPromptDto } from './dto/prompt.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('prompts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api/v1/prompts')
export class PromptsController {
  constructor(private readonly service: PromptsService) {}

  @Get()
  @ApiOperation({ summary: 'List prompt templates + versions' })
  list(@Query('key') key?: string) {
    return this.service.list(key);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new draft version' })
  create(@Body() dto: CreatePromptDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createDraft(dto, user.userId);
  }

  @Post(':key/:version/publish')
  @ApiOperation({ summary: 'Publish a version (retires the previous live one)' })
  publish(@Param('key') key: string, @Param('version') version: string) {
    return this.service.publish(key, Number(version));
  }

  @Post(':key/:version/preview')
  @ApiOperation({ summary: 'Sandbox-render a version with variables' })
  preview(
    @Param('key') key: string,
    @Param('version') version: string,
    @Body() dto: PreviewPromptDto,
  ) {
    return this.service.preview(key, Number(version), dto.variables ?? {});
  }
}
