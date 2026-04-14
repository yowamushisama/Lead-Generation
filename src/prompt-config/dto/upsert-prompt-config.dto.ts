import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export const ALLOWED_TONES = ['professional', 'casual', 'direct', 'consultative', 'custom'] as const;
export const ALLOWED_CTA_STYLES = ['reply_question', 'book_call', 'demo_request', 'custom'] as const;

export class UpsertPromptConfigDto {
  // ── Positioning ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'What your company does in plain language' })
  @IsOptional()
  @IsString()
  companyDescription?: string;

  @ApiPropertyOptional({ description: 'The core offer / service being pitched' })
  @IsOptional()
  @IsString()
  coreOffer?: string;

  @ApiPropertyOptional({ description: 'Who the offer is specifically for' })
  @IsOptional()
  @IsString()
  targetPersona?: string;

  @ApiPropertyOptional({ description: 'The main problem this offer solves' })
  @IsOptional()
  @IsString()
  mainPainSolved?: string;

  @ApiPropertyOptional({ description: 'The primary outcome the customer achieves' })
  @IsOptional()
  @IsString()
  mainOutcomePromised?: string;

  @ApiPropertyOptional({ description: 'Proof points, case studies, or credibility signals', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proofPoints?: string[];

  // ── Voice & CTA ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: `Tone preset: ${ALLOWED_TONES.join(' | ')}` })
  @IsOptional()
  @IsIn(ALLOWED_TONES)
  preferredTone?: typeof ALLOWED_TONES[number];

  @ApiPropertyOptional({ description: 'Free-text tone instructions when preferredTone is "custom"' })
  @IsOptional()
  @IsString()
  customToneInstructions?: string;

  @ApiPropertyOptional({ description: `CTA preset: ${ALLOWED_CTA_STYLES.join(' | ')}` })
  @IsOptional()
  @IsIn(ALLOWED_CTA_STYLES)
  ctaStyle?: typeof ALLOWED_CTA_STYLES[number];

  @ApiPropertyOptional({ description: 'Custom CTA text when ctaStyle is "custom"' })
  @IsOptional()
  @IsString()
  customCta?: string;

  // ── Guardrails ───────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Phrases that must never appear in outreach', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenPhrases?: string[];

  @ApiPropertyOptional({ description: 'Claims that must never be made', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenClaims?: string[];

  @ApiPropertyOptional({ description: 'Compliance or legal notes injected into prompt context' })
  @IsOptional()
  @IsString()
  complianceNotes?: string;

  // ── Advanced overrides ───────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Replaces the entire personalization system prompt' })
  @IsOptional()
  @IsString()
  personalizationPromptOverride?: string;

  @ApiPropertyOptional({ description: 'Replaces the entire outreach system prompt' })
  @IsOptional()
  @IsString()
  outreachPromptOverride?: string;
}
