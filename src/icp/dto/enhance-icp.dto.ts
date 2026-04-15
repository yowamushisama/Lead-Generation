import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnhanceICPDto {
  @ApiProperty({
    description: 'ICP profile name used to generate a suggested config via AI',
    example: 'Series B FinTech CFOs',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}
