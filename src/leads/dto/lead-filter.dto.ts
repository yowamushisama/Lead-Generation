import { IsOptional, IsString, IsInt, IsUUID, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { LeadTier } from '../../common/enums/lead-tier.enum';
import { LeadSource } from '../../common/enums/lead-source.enum';

export class LeadFilterDto {
  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: LeadTier })
  @IsOptional()
  @IsEnum(LeadTier)
  tier?: LeadTier;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minScore?: number;

  @ApiPropertyOptional({ maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(100)
  maxScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Search by name, company, or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter leads created after this date (ISO 8601)' })
  @IsOptional()
  @IsString()
  createdAfter?: string;

  @ApiPropertyOptional({ description: 'Filter leads created before this date (ISO 8601)' })
  @IsOptional()
  @IsString()
  createdBefore?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  includeOptedOut?: boolean;
}
