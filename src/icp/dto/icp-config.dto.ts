import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GmapsFiltersDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minReviewCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minYearsInBusiness?: number;

  @IsOptional()
  @IsIn(['any', 'none', 'none_or_social_only'])
  websitePresence?: string;
}

export class SourceFiltersDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => GmapsFiltersDto)
  googleMaps?: GmapsFiltersDto;
}

export class ICPConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetIndustries?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetStages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetLocations?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  buyerSignals?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urgencySignals?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  budgetSignals?: string[];

  @IsOptional()
  @IsString()
  minCompanySize?: string;

  @IsOptional()
  @IsString()
  maxCompanySize?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedIndustries?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceFiltersDto)
  sourceFilters?: SourceFiltersDto;
}
