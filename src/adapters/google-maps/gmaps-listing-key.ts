import { placeIdFromUrl, normalizeGmapsUrl } from './gmaps-url-utils';

/**
 * Canonical key for a Google Maps listing URL.
 *
 * Used by ALL dedup layers — fast-scroll probe, scrollUntilStable seenInSession,
 * cursor.seenExternalIds, cursor.tailIds, and adapter cursor-cache lookups.
 * Having a single key function prevents the URL-vs-place-ID mismatch where probe
 * seeds would fail to match at seenInSession.has() checks.
 */
export function gmapsListingKey(url: string): string {
  return placeIdFromUrl(url) ?? normalizeGmapsUrl(url);
}
