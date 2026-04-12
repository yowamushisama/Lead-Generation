import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Q3 SaaS Founders Outreach', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Targeting Series-A SaaS founders in the US' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'UUID of the ICP profile to use for lead scoring', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  icpProfileId?: string;

  @ApiPropertyOptional({ description: 'Maximum leads to process per day', minimum: 1, maximum: 500, default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  maxLeadsPerDay?: number;

  @ApiPropertyOptional({ type: [String], example: ['linkedin', 'google_maps'], description: 'Acquisition sources to target' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSources?: string[];

  @ApiPropertyOptional({ example: 'SaaS', description: 'Target industry filter' })
  @IsOptional()
  @IsString()
  targetIndustry?: string;

  @ApiPropertyOptional({ example: 'United States', description: 'Target location filter' })
  @IsOptional()
  @IsString()
  targetLocation?: string;

  @ApiPropertyOptional({ description: 'Minimum intent confidence score (0–1) for a lead to qualify', minimum: 0, maximum: 1, default: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minIntentConfidence?: number;

  @ApiPropertyOptional({ description: 'Automatically approve messages for WARM-tier leads without human review', default: false })
  @IsOptional()
  @IsBoolean()
  autoApproveWarm?: boolean;
}
