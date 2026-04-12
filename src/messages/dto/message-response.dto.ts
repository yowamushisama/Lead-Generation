import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Minimal lead summary embedded in pending-approval responses */
export class MessageLeadSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional() name!: string | null;
  @ApiPropertyOptional() role!: string | null;
  @ApiPropertyOptional() company!: string | null;
  @ApiPropertyOptional() score!: number | null;
  @ApiPropertyOptional() tier!: string | null;
}

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) leadId!: string;
  @ApiPropertyOptional({ format: 'uuid' }) campaignId!: string | null;
  @ApiProperty({ example: 'linkedin', description: 'Delivery channel (linkedin, email, etc.)' }) channel!: string;
  @ApiPropertyOptional({ example: 'Quick question about scaling your team' }) subject!: string | null;
  @ApiProperty({ description: 'Message body (personalised outreach copy)' }) body!: string;
  @ApiProperty({ enum: ['OUTREACH', 'FOLLOW_UP', 'REPLY'], example: 'OUTREACH' }) type!: string;
  @ApiProperty({
    enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'QUEUED', 'SENT', 'REPLIED', 'REJECTED'],
    example: 'PENDING_APPROVAL',
  }) status!: string;
  @ApiPropertyOptional({ description: 'Spam probability score (0–1)', example: 0.04 }) spamScore!: number | null;
  @ApiPropertyOptional({ description: 'Uniqueness score (0–1)', example: 0.92 }) uniquenessScore!: number | null;
  @ApiPropertyOptional({ description: 'ID of the user who approved this message' }) approvedBy!: string | null;
  @ApiPropertyOptional() approvedAt!: Date | null;
  @ApiPropertyOptional() sentAt!: Date | null;
  @ApiPropertyOptional() repliedAt!: Date | null;
  @ApiProperty() generatedAt!: Date;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

/** Extended DTO returned by the pending-approval endpoint — includes embedded lead summary */
export class MessageWithLeadDto extends MessageResponseDto {
  @ApiPropertyOptional({ type: () => MessageLeadSummaryDto, description: 'Lead summary for the review queue' })
  lead!: MessageLeadSummaryDto | null;
}
