import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardLeadsDto {
  @ApiProperty({ description: 'Total leads in the 30-day window' }) total!: number;
  @ApiProperty({ description: 'HOT tier leads' }) hot!: number;
  @ApiProperty({ description: 'WARM tier leads' }) warm!: number;
  @ApiProperty({ description: 'COLD tier leads' }) cold!: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, description: 'Lead count per status' })
  byStatus!: Record<string, number>;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, description: 'Lead count per tier' })
  byTier!: Record<string, number>;
}

export class DashboardOutreachDto {
  @ApiProperty({ description: 'Messages with status SENT' }) messagesSent!: number;
  @ApiProperty({ description: 'Ratio of replied leads to messages sent', example: 0.15 }) replyRate!: number;
  @ApiProperty({ description: 'Ratio of converted leads to total leads', example: 0.08 }) conversionRate!: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, description: 'Message count per status' })
  byStatus!: Record<string, number>;
}

export class DashboardUsageDto {
  @ApiPropertyOptional({ description: 'AI tokens used today (BigInt serialised as string or number)' }) aiTokensUsed?: number | string;
  @ApiPropertyOptional({ description: 'AI cost in cents today' }) aiCostCents?: number;
  @ApiPropertyOptional({ description: 'Leads processed today' }) leadsProcessed?: number;
  @ApiPropertyOptional({ description: 'Scrape jobs executed today' }) scrapesExecuted?: number;
  @ApiPropertyOptional({ description: 'External API calls made today' }) apiCallsMade?: number;
}

export class DashboardResponseDto {
  @ApiProperty({ example: '30 days' }) period!: string;
  @ApiProperty({ type: () => DashboardLeadsDto }) leads!: DashboardLeadsDto;
  @ApiProperty({ type: () => DashboardOutreachDto }) outreach!: DashboardOutreachDto;
  @ApiPropertyOptional({ type: () => DashboardUsageDto }) usage?: DashboardUsageDto | null;
}

export class FunnelStageDto {
  @ApiProperty({ example: 'REPLIED', description: 'Pipeline stage name' }) stage!: string;
  @ApiProperty({ description: 'Number of leads at this stage' }) count!: number;
  @ApiProperty({ description: 'Leads that dropped off since the previous stage' }) dropOff!: number;
}

export class SourceBreakdownDto {
  @ApiProperty({ example: 'linkedin', description: 'Acquisition source identifier' }) source!: string;
  @ApiProperty({ description: 'Number of leads from this source' }) count!: number;
}

export class TrendRowDto {
  @ApiProperty({ description: 'Date of the usage record' }) date!: Date;
  @ApiProperty({ description: 'Leads processed on that date' }) leadsProcessed!: number;
  @ApiProperty({ description: 'AI tokens used on that date (BigInt serialised as string)' }) aiTokensUsed!: string;
}
