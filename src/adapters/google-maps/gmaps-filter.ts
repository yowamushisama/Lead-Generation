import { GmapsFilters, WebsitePresenceMode } from '../../common/types/icp.types';
import { GmapsPlace } from './gmaps-extraction.types';

export type GmapsFilterReason = 'rating' | 'reviews' | 'years' | 'website';

export interface GmapsFilterResult {
  passed: boolean;
  reasons: GmapsFilterReason[];
}

/**
 * Social / link-aggregator / messaging hostnames that indicate a business has
 * no meaningful standalone website. Must stay in sync with the SQL migration
 * backfill logic in prisma/migrations/manual/*_lead_has_meaningful_website.sql.
 */
export const SOCIAL_HOSTS = new Set([
  'facebook.com',
  'instagram.com',
  'linktr.ee',
  'linktree.com',
  'tiktok.com',
  'wa.me',
  'whatsapp.com',
  't.me',
  'telegram.me',
  'm.me',
]);

/**
 * Classify a website URL.
 * Returns true if the site is a real business domain, false if absent/social/invalid.
 * Returns null only when the input is undefined (caller did not provide a website field).
 */
export function classifyWebsite(url: string | null | undefined): boolean | null {
  if (url === undefined) return null;
  if (url === null || url.trim() === '') return false;

  let hostname: string;
  try {
    // Handle both protocol-prefixed and bare URLs.
    const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    hostname = new URL(normalized).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }

  if (!hostname) return false;
  return !SOCIAL_HOSTS.has(hostname);
}

/** Apply ICP Google Maps filters to a scraped place. Collects all failure reasons. */
export function evaluateGmapsFilters(
  place: GmapsPlace,
  filters?: GmapsFilters,
): GmapsFilterResult {
  if (!filters) return { passed: true, reasons: [] };

  const reasons: GmapsFilterReason[] = [];

  if (filters.minRating != null) {
    if (place.rating == null || place.rating < filters.minRating) {
      reasons.push('rating');
    }
  }

  if (filters.minReviewCount != null) {
    if (place.reviewCount == null || place.reviewCount < filters.minReviewCount) {
      reasons.push('reviews');
    }
  }

  if (filters.minYearsInBusiness != null) {
    if ((place as any).yearsInBusiness == null || (place as any).yearsInBusiness < filters.minYearsInBusiness) {
      reasons.push('years');
    }
  }

  const mode: WebsitePresenceMode = filters.websitePresence ?? 'any';
  if (mode !== 'any') {
    const website = place.website;
    if (mode === 'none') {
      if (website && website.trim() !== '') reasons.push('website');
    } else {
      // none_or_social_only — pass only when website is absent or social
      const isMeaningful = classifyWebsite(website);
      if (isMeaningful === true) reasons.push('website');
    }
  }

  return { passed: reasons.length === 0, reasons };
}

/** Helper to determine if a gmaps filter config requires detail-page extraction. */
export function requiresDetailExtraction(filters?: GmapsFilters): boolean {
  if (!filters) return false;
  const mode = filters.websitePresence ?? 'any';
  return mode === 'none_or_social_only' || filters.minYearsInBusiness != null;
}
