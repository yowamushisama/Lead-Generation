import { ApiProperty } from '@nestjs/swagger';

/** A single entry in a stored conversation message thread */
export class StoredMessageEntryDto {
  @ApiProperty({ enum: ['us', 'them'] }) role!: string;
  @ApiProperty() content!: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) timestamp!: string;
}

export class RetentionSummaryDto {
  @ApiProperty({ description: 'Total leads in the organisation' }) totalLeads!: number;
  @ApiProperty({ description: 'Leads with status OPT_OUT' }) optedOut!: number;
  @ApiProperty({ description: 'Leads whose dataExpiresAt falls within the next 7 days' }) expiringSoon!: number;
  @ApiProperty({ description: 'Configured data-retention window in days (default: 90)', example: 90 }) retentionPolicyDays!: number;
}

export class LeadExportMessageDto {
  @ApiProperty() channel!: string;
  @ApiProperty() body!: string;
  @ApiProperty() status!: string;
  @ApiProperty() generatedAt!: Date;
}

export class LeadExportConversationDto {
  @ApiProperty() channel!: string;
  @ApiProperty({ type: () => [StoredMessageEntryDto] }) messages!: StoredMessageEntryDto[];
  @ApiProperty() status!: string;
}

export class LeadExportDataDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) email!: string | null;
  @ApiProperty({ nullable: true }) role!: string | null;
  @ApiProperty({ nullable: true }) company!: string | null;
  @ApiProperty() source!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() status!: string;
  @ApiProperty() score!: number;
  @ApiProperty({ type: () => [LeadExportMessageDto] }) messages!: LeadExportMessageDto[];
  @ApiProperty({ type: () => [LeadExportConversationDto] }) conversations!: LeadExportConversationDto[];
}

export class LeadExportResponseDto {
  @ApiProperty({ description: 'ISO 8601 timestamp of when the export was generated' }) exportedAt!: string;
  @ApiProperty({ type: () => LeadExportDataDto }) lead!: LeadExportDataDto;
}
