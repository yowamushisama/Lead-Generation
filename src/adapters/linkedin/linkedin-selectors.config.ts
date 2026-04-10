/**
 * LinkedIn DOM Selectors — single source of truth.
 *
 * ── WHEN SELECTORS BREAK ─────────────────────────────────────────────────────
 *
 *   1. Run the DOM dumper:
 *        npm run linkedin:dump-dom -- --keyword "hiring SDR"
 *
 *   2. Open the generated report in linkedin-dom-dumps/:
 *        linkedin-dom-dumps/YYYY-MM-DD_HH-mm_<keyword>_report.txt
 *
 *   3. Paste the report (or the cards.html) into Claude Code and say:
 *        "Update LINKEDIN_SELECTORS in linkedin-selectors.config.ts
 *         based on this HTML — keep the same interface shape."
 *
 *   4. Rebuild and test:
 *        npm run build && npm run linkedin:test-live -- --keyword "hiring SDR"
 *
 * ── SELECTOR FALLBACK CHAINS ─────────────────────────────────────────────────
 *
 *   Every array is tried in order at runtime. The first selector that returns
 *   a non-null match wins. Add new candidates at the TOP of each array when
 *   LinkedIn changes their DOM — keep old ones as lower-priority fallbacks.
 *
 * Last verified: 2026-04-06
 * Selector version: 2
 */

export interface LinkedInSelectors {
  /** Used in waitForSelector after navigating to the search page */
  waitForPost: string;

  /**
   * Post-card container selectors tried in order.
   * First selector that returns ≥1 element is used; the rest are skipped.
   */
  postContainers: string[];

  /**
   * Last-resort: scan all [data-urn] elements and keep only those that
   * contain at least one of these child selectors.
   */
  postContainerFallbackRequires: string[];

  /** Author name element (tried in order) */
  authorName: string[];

  /**
   * Author profile link element — used when the name element is not an <a>.
   * Tried in order; used to extract the /in/... href.
   */
  authorLink: string[];

  /** Post content text (tried in order) */
  content: string[];

  /** Author headline / subtitle shown below the name (tried in order) */
  headline: string[];

  /** Posted-at time element (tried in order) */
  postedAt: string[];

  /** Any one present means the session is still authenticated */
  sessionValid: string[];

  lastVerified: string;
  version: number;
}

export const LINKEDIN_SELECTORS: LinkedInSelectors = {
  lastVerified: '2026-04-06',
  version: 2,

  // ── Page wait ────────────────────────────────────────────────────────────────
  waitForPost: '[data-urn*="activity"], .occludable-update, [data-urn]',

  // ── Post containers ──────────────────────────────────────────────────────────
  postContainers: [
    '[data-urn*="activity"]',   // feed posts in content search (primary)
    '[data-urn*="ugcPost"]',    // user-generated content posts
    '.occludable-update',        // older feed wrapper class
  ],

  postContainerFallbackRequires: [
    '.update-components-text',
    '.break-words',
    '.feed-shared-update-v2__description',
  ],

  // ── Author name ──────────────────────────────────────────────────────────────
  authorName: [
    '.update-components-actor__name a',    // current primary (2025)
    '.update-components-actor__name',      // when link is separate
    '.feed-shared-actor__name a',          // legacy feed card
    '.entity-result__title-text a',        // people/entity search result
  ],

  // ── Author link ──────────────────────────────────────────────────────────────
  authorLink: [
    'a[href*="/in/"]',                          // any profile link in card
    '.app-aware-link[href*="/in/"]',            // branded profile link
    '.update-components-actor__meta-link',      // meta link below name
  ],

  // ── Content ──────────────────────────────────────────────────────────────────
  content: [
    '.update-components-text',                   // current primary (2025)
    '.attributed-text-segment-list__content',    // rich-text wrapper
    '.break-words',                              // older wrapper
    '.feed-shared-update-v2__description',       // legacy description block
  ],

  // ── Headline ─────────────────────────────────────────────────────────────────
  headline: [
    '.update-components-actor__description',     // current primary (2025)
    '.feed-shared-actor__description',           // legacy feed card
    '.entity-result__primary-subtitle',          // entity search result
    '.subline-level-1',                          // older profile subtitle
  ],

  // ── Posted-at ────────────────────────────────────────────────────────────────
  postedAt: [
    'time',                                        // standard <time> element
    '.update-components-actor__sub-description',   // text timestamp (current)
    '.feed-shared-actor__sub-description',         // legacy
  ],

  // ── Session validation ───────────────────────────────────────────────────────
  sessionValid: [
    '.global-nav__me',
    '[data-test-id="nav-settings__dropdown-trigger"]',
  ],
};
