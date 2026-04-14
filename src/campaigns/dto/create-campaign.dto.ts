import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpsertPromptConfigDto } from '../../prompt-config/dto/upsert-prompt-config.dto';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Q3 SaaS Founders Outreach', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Targeting Series-A SaaS founders in the US' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'B2B SaaS consulting', description: 'Offer or service category being promoted' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiProperty({ description: 'UUID of the ICP profile — required to derive targeting (industries, locations, keywords)', format: 'uuid' })
  @IsUUID()
  icpProfileId!: string;

  @ApiPropertyOptional({
    description: 'Campaign objective — what a successful conversion looks like',
    enum: ['replies', 'calls_booked', 'demo_requests', 'meetings'],
    example: 'demo_requests',
  })
  @IsOptional()
  @IsString()
  @IsIn(['replies', 'calls_booked', 'demo_requests', 'meetings'])
  objective?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['email', 'linkedin_dm'],
    description: 'Outreach channels to use for this campaign',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  linkedChannels?: string[];

  @ApiPropertyOptional({
    description: 'Tone to use when generating outreach messages',
    enum: ['professional', 'casual', 'direct', 'consultative'],
    example: 'professional',
  })
  @IsOptional()
  @IsString()
  @IsIn(['professional', 'casual', 'direct', 'consultative'])
  outreachTone?: string;

  @ApiPropertyOptional({
    description: 'Approval mode for generated messages',
    enum: ['manual', 'semi_auto', 'auto'],
    example: 'manual',
  })
  @IsOptional()
  @IsString()
  @IsIn(['manual', 'semi_auto', 'auto'])
  approvalMode?: string;

  @ApiPropertyOptional({ description: 'Maximum leads to process per day', minimum: 1, maximum: 500, default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  maxLeadsPerDay?: number;

  @ApiPropertyOptional({ description: 'Maximum outreach messages to send per day', minimum: 1, maximum: 500, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  maxOutreachPerDay?: number;

  @ApiPropertyOptional({ type: [String], example: ['linkedin', 'google_maps'], description: 'Acquisition sources to target' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSources?: string[];

  @ApiPropertyOptional({ description: 'Minimum intent confidence score (0–1) for a lead to qualify', minimum: 0, maximum: 1, default: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minIntentConfidence?: number;

  /** @deprecated Use approvalMode instead */
  @ApiPropertyOptional({ description: 'Automatically approve messages for WARM-tier leads without human review', default: false })
  @IsOptional()
  @IsBoolean()
  autoApproveWarm?: boolean;

  @ApiPropertyOptional({ description: 'If true, campaign is saved as DRAFT instead of launched immediately', default: false })
  @IsOptional()
  @IsBoolean()
  startAsDraft?: boolean;

  @ApiPropertyOptional({ description: 'UUID of a reusable prompt config from the library to attach to this campaign', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  promptConfigId?: string | null;

  @ApiPropertyOptional({
    description: 'Campaign-level overrides applied on top of the linked prompt config. Only prompt config fields are accepted.',
    type: UpsertPromptConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertPromptConfigDto)
  promptOverrides?: UpsertPromptConfigDto | null;
}
