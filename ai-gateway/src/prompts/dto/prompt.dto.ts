import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreatePromptDto {
  @ApiProperty({ example: 'chatbot.system' })
  @IsString()
  key!: string;

  @ApiProperty({ example: 'chat' })
  @IsString()
  task!: string;

  @ApiProperty({ description: 'Template body with {vars}' })
  @IsString()
  content!: string;

  @ApiProperty({ type: [String], required: false, example: ['market', 'lang'] })
  @IsOptional()
  @IsArray()
  variables?: string[];
}

export class PreviewPromptDto {
  @ApiProperty({ example: { market: 'Algeria', lang: 'fr' } })
  @IsOptional()
  variables?: Record<string, string>;
}
