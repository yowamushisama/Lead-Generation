export interface PersonalContext {
  openingHook: string;
  painPointReference: string;
  valueProposition: string;
  socialProof?: string;
  callToAction: string;
  toneNotes: string;
}

export interface PsychologyProfile {
  primaryPainPoint: string;
  primaryDesire: string;
  primaryFear: string;
  motivationStyle: 'analytical' | 'driver' | 'expressive' | 'amiable';
  decisionMakingStyle: 'data-driven' | 'intuitive' | 'consensus' | 'authoritative';
  communicationPreference: 'direct' | 'detailed' | 'story-driven' | 'social-proof';
}

export interface PositioningStrategy {
  angle: string;
  differentiator: string;
  competitiveAdvantage: string;
  relevantCaseStudy?: string;
  objectionPreemption: string;
}

export type ToneProfile =
  | 'professional-formal'
  | 'professional-casual'
  | 'friendly-conversational'
  | 'direct-assertive'
  | 'empathetic-consultative';

export interface PersonalizationResult {
  personalContext: PersonalContext;
  psychology: PsychologyProfile;
  positioning: PositioningStrategy;
  toneProfile: ToneProfile;
  recommendedChannel: string;
}
