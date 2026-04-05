import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateLeadDto } from './create-lead.dto';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { IsEnum } from 'class-validator';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  optedOut?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recommendedChannel?: string;
}
