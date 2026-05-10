/**
 * URL utilities shared across Google Maps adapter, probe, and listing-key helpers.
 * Extracted from google-maps.adapter.ts so placeIdFromUrl and normalizeGmapsUrl
 * have a single authoritative definition.
 *
 * Google Maps uses two ID formats depending on the URL type:
 *   - Listing card URLs (search results feed): !1s0xHEX:0xHEX  (hex-encoded lat/lng pair)
 *   - Detail page URLs (after navigation):     !19sChIJxxxxxxx  (base64/ChIJ canonical ID)
 */

export function placeIdFromUrl(url: string): string | null {
  const chij = url.match(/!19s(ChIJ[A-Za-z0-9_-]+)/);
  if (chij) return chij[1];
  // Hex format present on listing cards: !1s0x<hex>%3A0x<hex> or !1s0x<hex>:0x<hex>
  const hex = url.match(/!1s(0x[0-9a-f]+(?:%3A|:)0x[0-9a-f]+)/i);
  if (hex) return hex[1].toLowerCase().replace('%3a', ':');
  return null;
}

/** Strip query-string from a Google Maps URL, keeping the stable data= path segment. */
export function normalizeGmapsUrl(url: string): string {
  return url.split('?')[0];
}
