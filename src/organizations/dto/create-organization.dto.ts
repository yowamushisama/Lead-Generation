import {
  IsString,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string = '';

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string = '';

  @ApiPropertyOptional({ enum: ['free', 'starter', 'growth', 'enterprise'], default: 'free' })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxLeadsPerDay?: number;

  @ApiPropertyOptional({ example: 'AI-powered sales automation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  serviceOffering?: string;

  @ApiPropertyOptional({ example: 'We close 30% faster than competitors' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  uniqueValue?: string;

  @ApiPropertyOptional({
    example: 'Position as the fast, affordable alternative to enterprise solutions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  positioningPrompt?: string;
}
