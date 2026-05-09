import { ApiProperty } from '@nestjs/swagger';

export class CampaignSkippedAdapterDto {
  @ApiProperty({ example: 'csv' }) adapter!: string;
  @ApiProperty({ example: 'manual_input_required' }) reason!: string;
}

export class CampaignRunSummaryDto {
  @ApiProperty({ format: 'uuid' }) runId!: string;
  @ApiProperty({ format: 'uuid' }) campaignId!: string;
  @ApiProperty({ enum: ['activation', 'scheduled', 'manual'], example: 'manual' }) trigger!: string;
  @ApiProperty({ description: 'Campaign-wide saved-lead goal for this run', example: 200 }) goalMaxLeads!: number;
  @ApiProperty({ description: 'True when saved >= goalMaxLeads', example: true }) reachedGoal!: boolean;
  @ApiProperty({
    description: 'Why the run stopped',
    enum: ['GOAL_REACHED', 'ADAPTERS_EXHAUSTED', 'SAFETY_LIMIT', 'ERROR'],
    example: 'GOAL_REACHED',
  }) endReason!: string;
  @ApiProperty({ type: [String], example: ['linkedin', 'google-maps'] }) adaptersAttempted!: string[];
  @ApiProperty({ type: [String], example: ['linkedin'] }) adaptersUsed!: string[];
  @ApiProperty({ type: [CampaignSkippedAdapterDto] }) skippedAdapters!: CampaignSkippedAdapterDto[];
  @ApiProperty({ description: 'New leads saved to the Lead table', example: 200 }) saved!: number;
  @ApiProperty({ description: 'Alias for duplicatesAtIngestion (backwards-compat)', example: 3 }) duplicates!: number;
  @ApiProperty({ description: 'Leads rejected by LeadIngestionService (already exist in DB)', example: 3 }) duplicatesAtIngestion!: number;
  @ApiProperty({ description: 'Candidates dropped by adapter before reaching ingestion (cursor cache + DB batch dedup)', example: 47 }) duplicatesAtAdapter!: number;
  @ApiProperty({ description: 'Total candidates yielded from all adapters', example: 250 }) candidatesYielded!: number;
  @ApiProperty({ description: 'Leads enqueued to the intent pipeline', example: 200 }) enqueued!: number;
  @ApiProperty({ description: 'Per-lead persistence or enqueue failures', example: 0 }) errors!: number;
}
