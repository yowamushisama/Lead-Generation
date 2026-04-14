import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { UpsertPromptConfigDto } from './upsert-prompt-config.dto';

export class UpdatePromptConfigDto extends UpsertPromptConfigDto {
  @ApiPropertyOptional({ description: 'Display name for this prompt profile', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Optional description of when to use this profile' })
  @IsOptional()
  @IsString()
  description?: string;
}
