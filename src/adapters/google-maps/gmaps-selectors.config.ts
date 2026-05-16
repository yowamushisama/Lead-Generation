/**
 * Google Maps DOM Selectors — single source of truth.
 *
 * ── WHEN SELECTORS BREAK ─────────────────────────────────────────────────────
 *
 *   1. Run the DOM dumper:
 *        npm run gmaps:dump-dom -- --industries "plumber" --locations "Austin, TX"
 *
 *   2. Open the generated report in gmaps-dom-dumps/:
 *        gmaps-dom-dumps/YYYY-MM-DD_HH-mm_<query>_report.txt
 *
 *   3. Paste the report into Claude Code and say:
 *        "Update GMAPS_SELECTORS in gmaps-selectors.config.ts
 *         based on this HTML — keep the same interface shape."
 *
 *   4. Rebuild and test:
 *        npm run build && npm run gmaps:test-live -- --industries "plumber" --locations "Austin, TX"
 *
 * ── SELECTOR FALLBACK CHAINS ─────────────────────────────────────────────────
 *
 *   Every array is tried in order at runtime. First selector that returns a
 *   non-null match wins. Add new candidates at the TOP when Google changes DOM.
 *
 * Last verified: 2026-05-01
 * Selector version: 1
 */

export interface GmapsSelectors {
  lastVerified: string;
  version: number;

  /** Used in waitForSelector after navigating to search results */
  waitForFeed: string;

  /** Scrollable left-rail container that holds listing cards */
  feedContainer: string[];

  /** Individual listing card elements within the feed */
  listingCards: string[];

  /** Business name within a listing card (tile view) */
  tileName: string[];

  /** Rating text within a listing card (tile view) */
  tileRating: string[];

  /** Review count within a listing card (tile view) */
  tileReviewCount: string[];

  /** Category/type within a listing card (tile view) */
  tileCategory: string[];

  /** Website link/button within a listing card (tile view) */
  tileWebsite: string[];

  /** After clicking a card: wait for the detail panel to load */
  waitForDetail: string;

  /** Business name in the detail panel */
  detailName: string[];

  /** Rating in the detail panel */
  detailRating: string[];

  /** Review count button/element in the detail panel */
  detailReviewCount: string[];

  /** Category chip(s) in the detail panel */
  detailCategories: string[];

  /** Address element in the detail panel */
  detailAddress: string[];

  /** Website link in the detail panel */
  detailWebsite: string[];

  /**
   * Candidate elements whose text may contain "X years in business".
   * Matched with /(\d+)\+?\s+years?\s+in\s+business/i — best-effort, may be null.
   */
  detailYearsInBusinessCandidates: string[];

  /** Phone number element/button in the detail panel */
  detailPhone: string[];

  /** Button that expands the hours table (click to open) */
  detailHoursButton: string[];

  /** Hours table or element in the detail panel */
  detailHours: string[];

  /** Most-recent review timestamp within a single review card */
  reviewTimestamp: string[];

  /** Individual review cards in the detail panel */
  reviewCards: string[];

  /** Instagram link anywhere on the detail page */
  socialInstagram: string[];

  /** Facebook link anywhere on the detail page */
  socialFacebook: string[];

  /** TikTok link anywhere on the detail page */
  socialTikTok: string[];
}

export const GMAPS_SELECTORS: GmapsSelectors = {
  lastVerified: '2026-05-01',
  version: 1,

  // ── Page wait ────────────────────────────────────────────────────────────────
  waitForFeed: '[role="feed"], .m6QErb[aria-label], [jstcache="31"]',

  // ── Feed container (scrollable left rail) ────────────────────────────────────
  feedContainer: [
    'div[aria-label^="Results for"]',
    '.m6QErb[aria-label]',
    '[role="feed"]',
    '[jstcache="31"]',
  ],

  // ── Listing cards ────────────────────────────────────────────────────────────
  listingCards: [
    '.Nv2PK',                           // primary result card class (2025+)
    '[data-result-index]',
    'div[jsaction*="mouseover:pane"]',  // interactive card fallback
  ],

  // ── Tile-level fields (no click needed) ──────────────────────────────────────
  tileName: [
    '.qBF1Pd',                          // headline font class
    'span.fontHeadlineSmall',
    '.fontBodyMedium span:first-child',
  ],

  tileRating: [
    'span.MW4etd',
    'span[aria-hidden="true"][class*="rating"]',
  ],

  tileReviewCount: [
    'span.UY7F9',
    'span.fontBodyMedium[aria-label*="review"]',
  ],

  tileCategory: [
    '.W4Etze',
    '.fontBodyMedium > span:nth-child(2)',
    'span[class*="type"]',
  ],

  tileWebsite: [
    'a[data-value="Website"][href]',
    'a[aria-label^="Visit "][href]',
    'a[aria-label*="website" i][href]',
    'a[data-tooltip="Open website"][href]',
  ],

  // ── Detail panel (after click) ───────────────────────────────────────────────
  waitForDetail: 'h1.DUwDvf, h1[class*="DUwDvf"], .lMbq3e h2',

  detailName: [
    'h1.DUwDvf',
    'h1[class*="DUwDvf"]',
    '.lMbq3e h2',
    '.qrShPb h1',
  ],

  detailRating: [
    'div.F7nice span[aria-hidden="true"]',
    'span.MW4etd',
    '[aria-label*="stars"] span[aria-hidden]',
  ],

  detailReviewCount: [
    'div.F7nice span[aria-label*="review"]',
    'button[jsaction*="review"] span',
    '.HHrUdb span',
  ],

  detailCategories: [
    'button.DkEaL',
    'button[jsaction*="category"]',
    '.LBgpqf button',
    'div[class*="LBgpqf"] span',
  ],

  detailAddress: [
    'button[data-item-id="address"]',
    '.Io6YTe[data-tooltip]',
    'button[aria-label*="Address"]',
    '[data-tooltip="Copy address"]',
  ],

  detailWebsite: [
    'a[data-item-id="authority"]',
    'a[href][data-tooltip="Open website"]',
    'a[href^="http"][jsaction*="website"]',
  ],

  detailYearsInBusinessCandidates: [
    '.RcCsl span',               // attribute chips
    '.Io6YTe',                   // info rows
    '.iP2t7d',                   // about section items
    '[aria-label*="year"]',      // aria-labeled chips
    '.e2moi span',               // alternate chip container
    'li.hpLkke',                 // list items in about panel
  ],

  detailPhone: [
    'button[data-item-id^="phone:tel:"]',
    'button[aria-label*="phone"]',
    '[data-tooltip="Copy phone number"]',
    'a[href^="tel:"]',
  ],

  /** Button that expands the hours table (click to open) */
  detailHoursButton: [
    'button[data-item-id*="oh"]',
    '.OqCZI[data-hide-tooltip-on-mouse-down]',
    'button[aria-label*="hours"]',
    '.OMl5r button',
  ],

  detailHours: [
    'table.eK4R0b',
    '.t39EBf table',
    'table[class*="eK4R0b"]',
    '.o0Svhf',
    '[data-attrid*="hours"] table',
    '.y0skZc',
  ],

  // ── Reviews ──────────────────────────────────────────────────────────────────
  reviewCards: [
    '.jJc9Ad',
    '.gws-localreviews__google-review',
    'div[data-review-id]',
  ],

  reviewTimestamp: [
    '.rsqaWe',
    '.dehysf[class*="color-secondary"]',
    'span[class*="rsqaWe"]',
    '.xRkPPb span:nth-child(2)',
  ],

  // ── Social links (may appear anywhere in the detail panel) ───────────────────
  socialInstagram: ['a[href*="instagram.com"]'],
  socialFacebook: ['a[href*="facebook.com"]'],
  socialTikTok: ['a[href*="tiktok.com"]'],
};
