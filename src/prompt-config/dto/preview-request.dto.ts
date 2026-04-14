import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpsertPromptConfigDto } from './upsert-prompt-config.dto';

export class PreviewRequestDto {
  @ApiPropertyOptional({ description: 'Sample lead first name' })
  @IsOptional()
  @IsString()
  sampleLeadName?: string;

  @ApiPropertyOptional({ description: 'Sample lead job title' })
  @IsOptional()
  @IsString()
  sampleLeadRole?: string;

  @ApiPropertyOptional({ description: 'Sample lead company name' })
  @IsOptional()
  @IsString()
  sampleLeadCompany?: string;

  @ApiProperty({ description: 'Simulated intent content (post, comment, profile text, etc.)' })
  @IsString()
  sampleContent!: string;

  @ApiPropertyOptional({ description: 'Inferred pain points for the sample lead', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  samplePainPoints?: string[];

  @ApiPropertyOptional({
    description: 'Unsaved config overrides — merged over the persisted config so the preview reflects current edits',
    type: UpsertPromptConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertPromptConfigDto)
  configOverride?: UpsertPromptConfigDto;

  @ApiPropertyOptional({
    description: 'Campaign-level overrides applied on top of the base prompt config',
    type: UpsertPromptConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertPromptConfigDto)
  campaignOverrides?: UpsertPromptConfigDto;
}

export class RestoreVersionDto {
  @ApiProperty({ description: 'Version number to restore' })
  version!: number;
}
