import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationLeadSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Jane Smith' }) name!: string | null;
  @ApiPropertyOptional({ example: 'CTO' }) role!: string | null;
  @ApiPropertyOptional({ example: 'Acme Corp' }) company!: string | null;
  @ApiProperty({ description: 'Lead intent score (0–100)', example: 78 }) score!: number;
  @ApiProperty({ enum: ['HOT', 'WARM', 'COLD'], example: 'HOT' }) tier!: string;
}

export class ConversationMessageEntryDto {
  @ApiProperty({ enum: ['us', 'them'], description: 'Message author perspective' }) role!: string;
  @ApiProperty({ description: 'Message content' }) content!: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) timestamp!: string;
}

export class ConversationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) organizationId!: string;
  @ApiProperty({ format: 'uuid' }) leadId!: string;
  @ApiProperty({ example: 'linkedin-dm', description: 'Communication channel' }) channel!: string;
  @ApiProperty({ type: () => [ConversationMessageEntryDto], description: 'Full message thread' })
  messages!: ConversationMessageEntryDto[];
  @ApiProperty({ description: 'Number of messages in the thread' }) messageCount!: number;
  @ApiProperty({ description: 'Timestamp of the most recent message' }) lastMessageAt!: Date;
  @ApiPropertyOptional({ description: 'AI-suggested reply text' }) suggestedReply!: string | null;
  @ApiPropertyOptional({ description: 'Detected objection type (pricing, timing, authority, etc.)' }) objectionType!: string | null;
  @ApiPropertyOptional({ description: 'Detected sentiment (positive, neutral, negative)' }) sentiment!: string | null;
  @ApiPropertyOptional({ description: 'Recommended closing strategy' }) closingStrategy!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'CLOSED'], example: 'ACTIVE' }) status!: string;
  @ApiPropertyOptional({ type: () => ConversationLeadSummaryDto }) lead!: ConversationLeadSummaryDto | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ReplySuggestionsResponseDto {
  @ApiProperty({ description: 'True if an objection pattern was detected in the latest message' }) objectionDetected!: boolean;
  @ApiPropertyOptional({ description: 'Objection category (pricing, timing, authority, need, trust)' }) objectionType!: string | null;
  @ApiPropertyOptional({ description: 'Pre-built deterministic reply for the detected objection' }) deterministicSuggestion!: string | null;
  @ApiProperty({ type: [String], description: 'AI-generated reply suggestions' }) aiSuggestions!: string[];
  @ApiPropertyOptional({ description: 'Recommended approach from the AI' }) recommended!: string;
  @ApiPropertyOptional({ description: 'AI analysis of the conversation context' }) analysis!: string;
}
