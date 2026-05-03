export interface DeepSignalsInput {
  hasChatbot?: boolean;
  hasEstimateCalculator?: boolean;
  hasBookingWidget?: boolean;
  hasSchemaMarkup?: boolean;
  hasReviewSchema?: boolean;
  hasFAQSchema?: boolean;
  formFieldCount?: number | null;
  emergencyPositioning?: 'none' | 'mentioned' | 'prominent';
  detectedCrm?: string[];
  detectedEmailMarketing?: string[];
  hasMaintenancePlanCopy?: boolean;
  gapCount?: number;
}

export interface WebsiteAuditInput {
  title?: string | null;
  metaDescription?: string | null;
  ctaPresent?: boolean;
  loadMs?: number;
  deepSignals?: DeepSignalsInput | null;
}

export interface DigitalGapInput {
  enrichmentStatus?: string | null;
  websiteAudit?: WebsiteAuditInput | null;
  socialHandles?: { instagram?: string; facebook?: string; tiktok?: string } | null;
  rating?: number | null;
  reviewCount?: number | null;
  lastReviewAt?: string | Date | null;
  /** Industry / google types — used to gate service-industry sub-factors */
  industry?: string | null;
  googleTypes?: string[] | null;
}
