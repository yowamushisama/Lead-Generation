import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Acme Corp' }) name!: string;
  @ApiProperty({ example: 'acme-corp' }) slug!: string;
  @ApiProperty({ enum: ['free', 'starter', 'growth', 'enterprise'], example: 'starter' }) tier!: string;
  @ApiProperty({ description: 'Max leads that can be created per calendar day', example: 50 }) maxLeadsPerDay!: number;
  @ApiProperty({ description: 'Max AI tokens per billing month (BigInt serialised as string)', example: '1000000' }) maxAiTokensPerMonth!: string;
  @ApiPropertyOptional({ description: 'Description of service offering used in outreach copy' }) serviceOffering!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class OrgStatsLeadsDto {
  @ApiProperty({ description: 'Leads created today' }) today!: number;
  @ApiProperty({ description: 'All-time total leads' }) total!: number;
  @ApiProperty({ description: 'Leads with tier HOT' }) hot!: number;
  @ApiProperty({ description: 'Leads remaining today before daily cap', example: 47 }) remainingToday!: number;
}

export class OrgStatsOrganizationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() tier!: string;
  @ApiProperty({ description: 'Daily lead creation cap' }) maxLeadsPerDay!: number;
}

export class OrgStatsUsageDto {
  @ApiProperty({ description: 'AI tokens consumed today (BigInt serialised as string)', example: '12345' }) aiTokensUsed!: string;
  @ApiProperty({ description: 'Estimated AI cost in cents today' }) aiCostCents!: number;
  @ApiProperty({ description: 'Scrape jobs executed today' }) scrapesExecuted!: number;
  @ApiProperty({ description: 'Leads processed through the pipeline today' }) leadsProcessed!: number;
  @ApiProperty({ description: 'External API calls made today' }) apiCallsMade!: number;
}

export class OrgStatsResponseDto {
  @ApiProperty({ type: () => OrgStatsOrganizationDto }) organization!: OrgStatsOrganizationDto;
  @ApiProperty({ type: () => OrgStatsLeadsDto }) leads!: OrgStatsLeadsDto;
  @ApiPropertyOptional({ type: () => OrgStatsUsageDto, nullable: true }) usage!: OrgStatsUsageDto | null;
}
