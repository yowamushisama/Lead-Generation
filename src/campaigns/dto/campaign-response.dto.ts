import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CampaignResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ example: 'Q3 SaaS Founders Outreach' }) name!: string;
  @ApiPropertyOptional({ example: 'Targeting Series-A SaaS founders in the US' }) description!: string | null;
  @ApiPropertyOptional({ format: 'uuid' }) icpProfileId!: string | null;
  @ApiProperty({ enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'], example: 'ACTIVE' }) status!: string;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Campaign settings (maxLeadsPerDay, targetSources, etc.)' })
  settings!: Record<string, unknown> | null;
  @ApiPropertyOptional({ format: 'uuid', description: 'ID of the linked prompt config from the library' }) promptConfigId!: string | null;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Campaign-level overrides applied on top of the linked prompt config' })
  promptOverrides!: Record<string, unknown> | null;
  @ApiPropertyOptional({ type: 'object', description: 'Lightweight prompt config reference (id, name, version)' })
  promptConfig!: { id: string; name: string; version: number } | null;
  @ApiProperty({ description: 'Number of leads associated with this campaign (live count)' }) leadsGenerated!: number;
  @ApiProperty({ description: 'Number of messages sent under this campaign (live count)' }) messagesSent!: number;
  @ApiProperty({ description: 'Leads that replied (status = REPLIED)' }) replies!: number;
  @ApiProperty({ description: 'Leads that converted (status = CONVERTED)' }) conversions!: number;
  @ApiProperty({ description: 'Meetings booked (tracked separately; 0 until integrated)' }) meetings!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CampaignPerformanceMetricsDto {
  @ApiProperty() totalLeads!: number;
  @ApiProperty() messagesSent!: number;
  @ApiProperty({ description: 'replied / messagesSent', example: 0.14 }) replyRate!: number;
  @ApiProperty({ description: 'converted / totalLeads', example: 0.06 }) conversionRate!: number;
}

export class CampaignPerformanceResponseDto {
  @ApiProperty({ format: 'uuid' }) campaignId!: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, description: 'Count of leads per status' })
  leadsByStatus!: Record<string, number>;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, description: 'Count of messages per status' })
  messagesByStatus!: Record<string, number>;
  @ApiProperty({ type: () => CampaignPerformanceMetricsDto }) metrics!: CampaignPerformanceMetricsDto;
}
