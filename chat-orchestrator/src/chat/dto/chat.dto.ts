import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ required: false, description: 'Deep-link topic' })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiProperty({ required: false, enum: ['fr', 'ar', 'en'] })
  @IsOptional()
  @IsString()
  lang?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: "Where's my driver?" })
  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class ConfirmDto {
  @ApiProperty()
  @IsString()
  toolCallId!: string;

  @ApiProperty({ enum: ['accept', 'decline'] })
  @IsIn(['accept', 'decline'])
  decision!: 'accept' | 'decline';
}

export class EscalateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  summary!: string;

  @ApiProperty({ required: false, enum: ['normal', 'high', 'urgent'] })
  @IsOptional()
  @IsIn(['normal', 'high', 'urgent'])
  priority?: string;
}
