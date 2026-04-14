import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { UpsertPromptConfigDto } from './upsert-prompt-config.dto';

export class CreatePromptConfigDto extends UpsertPromptConfigDto {
  @ApiProperty({ description: 'Display name for this prompt profile in the library', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional description of when to use this profile' })
  @IsOptional()
  @IsString()
  description?: string;
}
