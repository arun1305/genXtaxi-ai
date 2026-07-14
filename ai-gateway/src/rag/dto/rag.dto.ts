import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateKbDocumentDto {
  @ApiProperty({ example: 'Cancellation Policy' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'fr', description: 'ISO language code' })
  @IsString()
  lang!: string;

  @ApiProperty({ example: 'policy' })
  @IsString()
  source!: string;

  @ApiProperty({ description: 'Raw document text (chunked on publish)' })
  @IsString()
  body!: string;
}

export class SearchKbDto {
  @ApiProperty({ example: 'How do I cancel a ride?' })
  @IsString()
  query!: string;

  @ApiProperty({ example: 'fr' })
  @IsString()
  lang!: string;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}
