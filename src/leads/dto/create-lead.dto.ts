import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  IsBoolean,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadDto {
  @ApiPropertyOptional({ example: 'reddit-post-abc123' })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiProperty({ example: 'reddit' })
  @IsString()
  source: string = '';

  @ApiPropertyOptional({ example: 'https://reddit.com/r/entrepreneur/...' })
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @ApiPropertyOptional({ example: 'intent', enum: ['intent', 'discovery'] })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxLength(200)
  name: string = '';

  @ApiPropertyOptional({ example: 'Founder @ Acme Corp | Scaling B2B SaaS' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: 'CEO' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string;

  @ApiPropertyOptional({ example: 'Acme Corporation' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @ApiPropertyOptional({ example: '11-50' })
  @IsOptional()
  @IsString()
  companySize?: string;

  @ApiPropertyOptional({ example: 'SaaS' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 'San Francisco, CA' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'john@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  optedOut?: boolean;
}
