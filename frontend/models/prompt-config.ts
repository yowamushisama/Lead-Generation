export interface PromptConfig {
  id: string;
  organizationId: string;

  // Library metadata
  name: string;
  description?: string;
  status: 'active' | 'archived';
  /** Number of campaigns currently linked to this prompt config */
  campaignCount?: number;

  // Positioning
  companyDescription?: string;
  coreOffer?: string;
  targetPersona?: string;
  mainPainSolved?: string;
  mainOutcomePromised?: string;
  proofPoints?: string[];

  // Voice & CTA
  preferredTone: string;
  customToneInstructions?: string;
  ctaStyle: string;
  customCta?: string;

  // Guardrails
  forbiddenPhrases?: string[];
  forbiddenClaims?: string[];
  complianceNotes?: string;

  // Advanced overrides
  personalizationPromptOverride?: string;
  outreachPromptOverride?: string;

  // Versioning
  version: number;
  history?: PromptConfigSnapshot[];

  createdAt: string;
  updatedAt: string;
}

export interface PromptConfigSnapshot {
  version: number;
  savedAt: string;
  data: PromptConfigSnapshotData;
}

export interface PromptConfigSnapshotData extends UpsertPromptConfigDto {
  name?: string;
  description?: string;
  status?: 'active' | 'archived';
}

export interface UpsertPromptConfigDto {
  companyDescription?: string;
  coreOffer?: string;
  targetPersona?: string;
  mainPainSolved?: string;
  mainOutcomePromised?: string;
  proofPoints?: string[];
  preferredTone?: string;
  customToneInstructions?: string;
  ctaStyle?: string;
  customCta?: string;
  forbiddenPhrases?: string[];
  forbiddenClaims?: string[];
  complianceNotes?: string;
  personalizationPromptOverride?: string;
  outreachPromptOverride?: string;
}

export interface CreatePromptConfigDto extends UpsertPromptConfigDto {
  /** Required: display name for the prompt profile in the library */
  name: string;
  description?: string;
}

export interface PreviewRequest {
  sampleLeadName?: string;
  sampleLeadRole?: string;
  sampleLeadCompany?: string;
  sampleContent: string;
  samplePainPoints?: string[];
  /** Current unsaved form state — merged over saved config so preview reflects live edits */
  configOverride?: UpsertPromptConfigDto;
  /** Campaign-level overrides applied on top of the base prompt config */
  campaignOverrides?: UpsertPromptConfigDto;
}

export interface PreviewResult {
  personalization: {
    openingHook: string;
    painPointReference: string;
    valueProposition: string;
    callToAction: string;
    toneProfile: string;
    channel: string;
  };
  outreachMessage: string;
  channel: string;
  spamScore: number;
  isApproved: boolean;
}
