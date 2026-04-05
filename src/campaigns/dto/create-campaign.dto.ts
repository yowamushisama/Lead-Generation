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

export class CreateCampaignDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  icpProfileId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  maxLeadsPerDay?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSources?: string[];

  @IsOptional()
  @IsString()
  targetIndustry?: string;

  @IsOptional()
  @IsString()
  targetLocation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minIntentConfidence?: number;

  @IsOptional()
  @IsBoolean()
  autoApproveWarm?: boolean;
}
