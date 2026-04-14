import type { PromptConfig } from '@prisma/client';
import {
  ALLOWED_CTA_STYLES,
  ALLOWED_TONES,
  UpsertPromptConfigDto,
} from './dto/upsert-prompt-config.dto';

export interface PromptConfigSnapshotData extends Partial<UpsertPromptConfigDto> {
  name?: string;
  description?: string;
  status?: PromptConfig['status'];
}

const STRING_FIELDS = [
  'companyDescription',
  'coreOffer',
  'targetPersona',
  'mainPainSolved',
  'mainOutcomePromised',
  'customToneInstructions',
  'customCta',
  'complianceNotes',
  'personalizationPromptOverride',
  'outreachPromptOverride',
] as const satisfies readonly (keyof UpsertPromptConfigDto)[];

const ARRAY_FIELDS = [
  'proofPoints',
  'forbiddenPhrases',
  'forbiddenClaims',
] as const satisfies readonly (keyof UpsertPromptConfigDto)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : undefined;
}

function sanitizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((entry): entry is string => typeof entry === 'string');
  return strings.length > 0 ? strings : undefined;
}

export function sanitizePromptConfigOverrides(
  overrides: unknown,
): Partial<UpsertPromptConfigDto> | null {
  if (!isRecord(overrides)) return null;

  const sanitized: Partial<UpsertPromptConfigDto> = {};

  for (const field of STRING_FIELDS) {
    const value = sanitizeString(overrides[field]);
    if (value !== undefined) sanitized[field] = value;
  }

  for (const field of ARRAY_FIELDS) {
    const value = sanitizeStringArray(overrides[field]);
    if (value !== undefined) sanitized[field] = value;
  }

  if (
    typeof overrides.preferredTone === 'string'
    && ALLOWED_TONES.includes(overrides.preferredTone as (typeof ALLOWED_TONES)[number])
  ) {
    sanitized.preferredTone = overrides.preferredTone as UpsertPromptConfigDto['preferredTone'];
  }

  if (
    typeof overrides.ctaStyle === 'string'
    && ALLOWED_CTA_STYLES.includes(overrides.ctaStyle as (typeof ALLOWED_CTA_STYLES)[number])
  ) {
    sanitized.ctaStyle = overrides.ctaStyle as UpsertPromptConfigDto['ctaStyle'];
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}
