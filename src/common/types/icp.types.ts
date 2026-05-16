export type WebsitePresenceMode = 'any' | 'none' | 'none_or_social_only';

export interface GmapsFilters {
  minRating?: number;
  minReviewCount?: number;
  minYearsInBusiness?: number;
  websitePresence?: WebsitePresenceMode;
}

export interface GmapsFiltersWithEnabled extends GmapsFilters {
  enabled: boolean;
}

export interface ICPConfig {
  targetRoles: string[];
  targetIndustries: string[];
  targetStages: string[];
  targetLocations?: string[];
  buyerSignals: string[];
  urgencySignals: string[];
  budgetSignals: string[];
  minCompanySize?: string;
  maxCompanySize?: string;
  excludedIndustries?: string[];
  sourceFilters?: {
    googleMaps?: GmapsFiltersWithEnabled;
  };
}

export interface ICPMatch {
  isMatch: boolean;
  matchScore: number;
  matchedSignals: string[];
  missedSignals: string[];
  reasoning: string;
}

export interface ICPProfileData {
  id: string;
  organizationId: string;
  name: string;
  version: number;
  config: ICPConfig;
  learnedWeights?: Record<string, number>;
  conversionRate?: number;
  isActive: boolean;
}
