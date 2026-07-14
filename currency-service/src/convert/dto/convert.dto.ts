import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length } from 'class-validator';

export class ConvertDto {
  @ApiProperty({ example: 25000, description: 'Integer minor units' })
  @IsInt()
  amount!: number;

  @ApiProperty({ example: 'DZD' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ example: 'EUR', description: 'Target currency (display only)' })
  @IsString()
  @Length(3, 3)
  target!: string;
}
