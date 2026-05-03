import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeadMessageSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'linkedin-dm' }) channel!: string;
  @ApiPropertyOptional() subject!: string | null;
  @ApiProperty() body!: string;
  @ApiProperty({ example: 'SENT' }) status!: string;
  @ApiPropertyOptional() sentAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class LeadConversationSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'linkedin-dm' }) channel!: string;
  @ApiProperty() messageCount!: number;
  @ApiProperty() lastMessageAt!: Date;
  @ApiProperty({ enum: ['ACTIVE', 'CLOSED'] }) status!: string;
}

export class LeadDetailResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiPropertyOptional() externalId!: string | null;
  @ApiProperty() source!: string;
  @ApiPropertyOptional() sourceUrl!: string | null;
  @ApiProperty() sourceType!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() headline!: string | null;
  @ApiPropertyOptional() bio!: string | null;
  @ApiPropertyOptional() role!: string | null;
  @ApiPropertyOptional() company!: string | null;
  @ApiPropertyOptional() companySize!: string | null;
  @ApiPropertyOptional() industry!: string | null;
  @ApiPropertyOptional() location!: string | null;
  @ApiPropertyOptional() email!: string | null;
  @ApiPropertyOptional() phone!: string | null;
  @ApiPropertyOptional() website!: string | null;
  @ApiPropertyOptional() intentType!: string | null;
  @ApiPropertyOptional() intentUrgency!: string | null;
  @ApiPropertyOptional() intentConfidence!: number | null;
  @ApiProperty() isBuyer!: boolean;
  @ApiPropertyOptional() budgetSignal!: string | null;
  @ApiProperty() hiringIntent!: boolean;
  @ApiPropertyOptional() companyStage!: string | null;
  @ApiPropertyOptional() technicalLevel!: string | null;
  @ApiProperty() score!: number;
  @ApiProperty({ enum: ['HOT', 'WARM', 'COLD'] }) tier!: string;
  @ApiPropertyOptional() recommendedChannel!: string | null;
  @ApiProperty({ example: 'NEW' }) status!: string;
  @ApiProperty() optedOut!: boolean;
  @ApiPropertyOptional() optedOutAt!: Date | null;
  @ApiPropertyOptional() dataExpiresAt!: Date | null;
  @ApiPropertyOptional({ format: 'uuid' }) campaignId!: string | null;

  // Google Maps enrichment
  @ApiPropertyOptional() placeId!: string | null;
  @ApiPropertyOptional() rating!: number | null;
  @ApiPropertyOptional() reviewCount!: number | null;
  @ApiPropertyOptional() businessType!: string | null;
  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  businessHours!: Record<string, string> | null;
  @ApiPropertyOptional() lastReviewAt!: Date | null;
  @ApiPropertyOptional({ type: [String] }) googleTypes!: string[] | null;
  @ApiPropertyOptional({ type: 'object' })
  socialHandles!: { instagram?: string; facebook?: string; tiktok?: string } | null;

  // Website enrichment
  @ApiPropertyOptional({ type: 'object' })
  websiteAudit!: {
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    hasViewport: boolean;
    ctaPresent: boolean;
    techStack: string[];
    loadMs: number;
    deepSignals?: Record<string, unknown>;
  } | null;
  @ApiPropertyOptional({ enum: ['OK', 'NO_WEBSITE', 'UNREACHABLE', 'TIMEOUT'] })
  enrichmentStatus!: string | null;

  // Psychographic & scoring (detail-only fields)
  @ApiPropertyOptional({ type: 'object' })
  scoreBreakdown!: Record<string, unknown> | null;
  @ApiPropertyOptional({ type: [String] })
  painPoints!: string[] | null;
  @ApiPropertyOptional({ type: [String] })
  fears!: string[] | null;
  @ApiPropertyOptional({ type: [String] })
  desires!: string[] | null;
  @ApiPropertyOptional()
  intentReasoning!: string | null;
  @ApiPropertyOptional()
  toneProfile!: string | null;

  @ApiProperty({ type: () => [LeadMessageSummaryDto], description: 'Up to 5 most recent messages' })
  messages!: LeadMessageSummaryDto[];
  @ApiProperty({ type: () => [LeadConversationSummaryDto], description: 'Up to 3 most recent conversations' })
  conversations!: LeadConversationSummaryDto[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
