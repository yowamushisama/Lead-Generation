export interface WebsiteAudit {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  hasViewport: boolean;
  ctaPresent: boolean;
  techStack: string[];
  loadMs: number;
  deepSignals?: DeepSignals;
}

export type EmergencyPositioning = 'none' | 'mentioned' | 'prominent';

export interface DeepSignals {
  hasChatbot: boolean;
  chatbotVendor: string | null;
  hasEstimateCalculator: boolean;
  hasBookingWidget: boolean;
  bookingVendor: string | null;
  hasLiveChat: boolean;
  formFieldCount: number | null;

  hasSchemaMarkup: boolean;
  schemaTypes: string[];
  hasReviewSchema: boolean;
  hasFAQSchema: boolean;

  hasStickyHeader: boolean;
  hasClickToCall: boolean;
  hasFloatingCta: boolean;

  emergencyPositioning: EmergencyPositioning;

  detectedCrm: string[];
  detectedAnalytics: string[];
  detectedEmailMarketing: string[];

  locationsListed: number;

  hasTeamPage: boolean;
  hasBlog: boolean;
  hasCaseStudies: boolean;
  hasMaintenancePlanCopy: boolean;

  gapCount: number;
}

export type EnrichmentStatus = 'OK' | 'NO_WEBSITE' | 'UNREACHABLE' | 'TIMEOUT';

export interface WebsiteEnrichmentOutput {
  websiteAudit: WebsiteAudit | null;
  socialHandles: { instagram?: string; facebook?: string; tiktok?: string };
  enrichmentStatus: EnrichmentStatus;
}
