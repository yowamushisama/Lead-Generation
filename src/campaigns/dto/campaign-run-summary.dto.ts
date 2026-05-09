import { ApiProperty } from '@nestjs/swagger';

export class CampaignSkippedAdapterDto {
  @ApiProperty({ example: 'csv' }) adapter!: string;
  @ApiProperty({ example: 'manual_input_required' }) reason!: string;
}

export class CampaignRunSummaryDto {
  @ApiProperty({ format: 'uuid' }) campaignId!: string;
  @ApiProperty({ enum: ['activation', 'scheduled', 'manual'], example: 'manual' }) trigger!: string;
  @ApiProperty({ type: [String], example: ['linkedin', 'google-maps'] }) adaptersAttempted!: string[];
  @ApiProperty({ type: [String], example: ['linkedin'] }) adaptersUsed!: string[];
  @ApiProperty({ type: [CampaignSkippedAdapterDto] }) skippedAdapters!: CampaignSkippedAdapterDto[];
  @ApiProperty({ description: 'Number of new leads persisted to the Lead table', example: 5 }) saved!: number;
  @ApiProperty({ description: 'Number of scraped leads skipped because they already exist', example: 2 }) duplicates!: number;
  @ApiProperty({ description: 'Number of leads enqueued to the intent pipeline', example: 5 }) enqueued!: number;
  @ApiProperty({ description: 'Number of per-lead persistence or enqueue failures', example: 0 }) errors!: number;
}
