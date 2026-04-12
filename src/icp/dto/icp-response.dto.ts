import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents the config JSON blob stored on the ICPProfile row.
 * Extracted from the `config` column via Prisma JSON field.
 */
export class ICPConfigDto {
  @ApiPropertyOptional({ type: [String], example: ['CEO', 'CTO', 'Founder'] }) targetRoles?: string[];
  @ApiPropertyOptional({ type: [String], example: ['SaaS', 'Fintech'] }) targetIndustries?: string[];
  @ApiPropertyOptional({ type: [String], example: ['Series-A', 'Seed'] }) targetStages?: string[];
  @ApiPropertyOptional({ type: [String], example: ['US', 'Canada'] }) targetLocations?: string[];
  @ApiPropertyOptional({ type: [String] }) buyerSignals?: string[];
  @ApiPropertyOptional({ type: [String] }) urgencySignals?: string[];
  @ApiPropertyOptional({ type: [String] }) budgetSignals?: string[];
  @ApiPropertyOptional({ type: [String] }) excludedIndustries?: string[];
}

export class ICPProfileResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ example: 'B2B SaaS Founders' }) name!: string;
  @ApiProperty({ description: 'Auto-incremented version; bumped each time config is updated', example: 3 }) version!: number;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional({ type: () => ICPConfigDto, description: 'Targeting criteria for this ICP profile' }) config?: ICPConfigDto | null;
  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'number' }, description: 'Machine-learned per-signal weights' }) learnedWeights!: Record<string, number> | null;
  @ApiPropertyOptional({ description: 'Conversion rate for leads matched by this profile', example: 0.12 }) conversionRate!: number | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ICPStatsDto {
  @ApiProperty({ description: 'Total leads in the organisation' }) totalLeads!: number;
  @ApiProperty({ description: 'Leads with status CONVERTED' }) convertedLeads!: number;
  @ApiProperty({ description: 'convertedLeads / totalLeads', example: 0.09 }) conversionRate!: number;
  @ApiProperty({ description: 'Current profile version' }) version!: number;
  @ApiProperty({ description: 'Number of keys in learnedWeights' }) learnedWeightsCount!: number;
}

export class ICPStatsResponseDto {
  @ApiProperty({ type: () => ICPProfileResponseDto }) profile!: ICPProfileResponseDto;
  @ApiProperty({ type: () => ICPStatsDto }) stats!: ICPStatsDto;
}
