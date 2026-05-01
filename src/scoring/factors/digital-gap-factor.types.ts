export interface WebsiteAuditInput {
  title?: string | null;
  metaDescription?: string | null;
  ctaPresent?: boolean;
  loadMs?: number;
}

export interface DigitalGapInput {
  enrichmentStatus?: string | null;
  websiteAudit?: WebsiteAuditInput | null;
  socialHandles?: { instagram?: string; facebook?: string; tiktok?: string } | null;
  rating?: number | null;
  reviewCount?: number | null;
  lastReviewAt?: string | Date | null;
}
