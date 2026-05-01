export interface WebsiteAudit {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  hasViewport: boolean;
  ctaPresent: boolean;
  techStack: string[];
  loadMs: number;
}

export type EnrichmentStatus = 'OK' | 'NO_WEBSITE' | 'UNREACHABLE' | 'TIMEOUT';

export interface WebsiteEnrichmentOutput {
  websiteAudit: WebsiteAudit | null;
  socialHandles: { instagram?: string; facebook?: string; tiktok?: string };
  enrichmentStatus: EnrichmentStatus;
}
