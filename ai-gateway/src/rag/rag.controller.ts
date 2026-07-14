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
import { Role } from '@genxtaxi/ai-shared';
import { RagService } from './rag.service';
import { CreateKbDocumentDto, SearchKbDto } from './dto/rag.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('kb')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/kb')
export class RagController {
  constructor(private readonly service: RagService) {}

  @Post('documents')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Upload/version a FAQ or policy document (admin)' })
  create(@Body() dto: CreateKbDocumentDto) {
    return this.service.createDocument(dto);
  }

  @Get('documents')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List KB documents' })
  list(@Query('lang') lang?: string) {
    return this.service.listDocuments(lang);
  }

  @Post('documents/:id/publish')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Chunk + embed + index a document into the RAG store' })
  publish(@Param('id') id: string) {
    return this.service.publishDocument(id);
  }

  @Post('search')
  @Roles(Role.ADMIN, Role.PASSENGER, Role.DRIVER)
  @ApiOperation({ summary: 'Vector search over policy/FAQ chunks (used by chatbot)' })
  search(@Body() dto: SearchKbDto) {
    return this.service.search(dto.query, dto.lang, dto.topK ?? 5);
  }
}
