import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AiTask, ToolDefinition } from '@genxtaxi/ai-shared';

class ChatMessageDto {
  @ApiProperty({ enum: ['system', 'user', 'assistant', 'tool'] })
  @IsString()
  role!: 'system' | 'user' | 'assistant' | 'tool';

  @ApiProperty()
  @IsString()
  content!: string;
}

export class CompleteDto {
  @ApiProperty({ enum: AiTask, default: AiTask.CHAT })
  @IsEnum(AiTask)
  task!: AiTask;

  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @ApiProperty({ default: 'gateway' })
  @IsString()
  feature!: string;

  @ApiProperty({ required: false, enum: ['text', 'json'] })
  @IsOptional()
  @IsString()
  responseFormat?: 'text' | 'json';

  /**
   * Function-calling tool schemas (spec §2.4). Passed straight to the provider;
   * deep JSON-schema validation is the caller's responsibility.
   */
  @ApiProperty({ required: false, type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  tools?: ToolDefinition[];
}

export class EmbedDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  texts!: string[];
}
