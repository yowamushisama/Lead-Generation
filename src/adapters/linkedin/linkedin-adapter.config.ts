/**
 * LinkedIn-specific adapter configuration types.
 *
 * `LinkedInAdapterConfig` extends the shared `AdapterConfig` without modifying it,
 * adding LinkedIn-specific search URL filters and post-extraction quality filters.
 */

import { AdapterConfig } from '../../common/interfaces/adapter.interface';

/**
 * Filters translated into LinkedIn search URL query parameters.
 * All fields are optional — omit to use LinkedIn defaults.
 */
export interface LinkedInSearchFilters {
  /** Maps to &datePosted= — filter posts by how recently they were published */
  datePosted?: 'past-24h' | 'past-week' | 'past-month';

  /**
   * Maps to &network= — restrict to specific connection degrees.
   * 'F' = 1st-degree, 'S' = 2nd-degree, 'O' = 3rd-degree and beyond.
   * Pass multiple values to combine, e.g. ['F', 'S'].
   */
  network?: Array<'F' | 'S' | 'O'>;

  /** Maps to &contentType= — filter by content type */
  contentType?: 'posts' | 'articles';
}

/**
 * Client-side quality filters applied after DOM extraction.
 * These do not affect the LinkedIn search URL.
 */
export interface LinkedInPostFilters {
  /**
   * Minimum character count for post content.
   * Posts with fewer characters are discarded.
   * Defaults to 10 when not set.
   */
  minContentLength?: number;

  /**
   * Require that at least one of these strings appears in the author's headline
   * (case-insensitive substring match). Posts whose author headline does not match
   * are discarded. Useful for targeting specific roles, e.g. ['VP', 'Director', 'CTO'].
   */
  headlineKeywords?: string[];
}

/**
 * LinkedIn-specific adapter configuration.
 * Cast `AdapterConfig` to this type inside the LinkedIn adapter to access these fields.
 */
export interface LinkedInAdapterConfig extends AdapterConfig {
  /** Filters appended to the LinkedIn search URL */
  searchFilters?: LinkedInSearchFilters;

  /** Client-side post quality filters applied after extraction */
  postFilters?: LinkedInPostFilters;

  /**
   * If set, collected leads are written to this path as a JSON file in addition
   * to being yielded. If the path ends with '/' it is treated as a directory and
   * a timestamped filename is generated automatically.
   */
  outputFile?: string;

  /**
   * Number of scroll passes per keyword search page.
   * More passes surface more lazy-loaded posts at the cost of time.
   * Defaults to 5.
   */
  scrollSteps?: number;
}
