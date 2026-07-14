import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { RoundingRule } from '@genxtaxi/ai-shared';

export class UpsertCurrencyDto {
  @ApiProperty({ example: 'DZD' })
  @IsString()
  @Length(3, 3)
  code!: string;

  @ApiProperty({ example: 2, description: 'Minor-unit exponent (XOF = 0)' })
  @IsInt()
  @Min(0)
  @Max(4)
  minorUnitExponent!: number;

  @ApiProperty({ enum: RoundingRule, default: RoundingRule.HALF_EVEN })
  @IsOptional()
  @IsString()
  roundingRule?: RoundingRule;

  @ApiProperty({ example: 'DA' })
  @IsString()
  symbol!: string;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
