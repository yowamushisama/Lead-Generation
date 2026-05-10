import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { GmapsRunStatsCollector } from './gmaps-run-stats.collector';

export interface CancellationSignal {
  reason: 'RUN_GOAL_REACHED' | 'RUN_SAFETY_LIMIT' | 'CANCELLED_BY_RUNNER' | null;
}

export interface GmapsAdapterConfig extends AdapterConfig {
  scrollSteps?: number;
  fetchDetails?: boolean;
  ignoreExhausted?: boolean;
  /** Injected by runner — per-run collector for scrape telemetry. */
  statsCollector?: GmapsRunStatsCollector;
  /** Injected by runner — set before `break` to pass a reason into the adapter finally block. */
  cancellationSignal?: CancellationSignal;
  /** Per-query safety ceiling: max detail-page navigations per query. Default: 200. */
  maxExtractionsPerQuery?: number;
  /** Per-query safety ceiling: max scroll steps. Default: 300. */
  maxScrollBudgetPerQuery?: number;
  /** Wallclock budget for the scroll phase only (ms). Default: 8 minutes. */
  maxScrollPhaseMs?: number;
  /** Wallclock budget for the extraction phase only (ms). Default: 35 minutes. */
  maxExtractPhaseMs?: number;
  /** Enable fast-scroll probe for this run (overrides env flag when true). Default: false. */
  fastScrollEnabled?: boolean;
}

export const GMAPS_PROFILE_KEY = 'gmaps';
export const INTER_QUERY_DELAY_MS = 3000;

// Fast-scroll probe tunables (Phase 2 — probe runs behind GMAPS_FASTSCROLL_ENABLED flag)
export const FAST_SCROLL_BUDGET = 40;           // max probe scroll steps before falling through
export const TAIL_HIT_THRESHOLD = 0.4;          // 40% tail-overlap → frontier crossed, switch to extraction
export const MIN_TAIL_FOR_PROBE = 10;           // skip probe if cursor.tailIds.length < 10
export const MIN_SHUFFLE_DETECT = 15;           // bail-out if 0 tail-overlap after N probe scrolls
export const MAX_FAST_SCROLL_PHASE_MS = 90_000; // 90s wallclock guard for probe phase

// Per-query tunables (adapter-side safety ceilings — not the saved-lead goal)
export const DUPLICATE_WALL_THRESHOLD = 15;    // consecutive scroll batches that yielded only known-dup URLs
export const NO_NEW_LISTINGS_THRESHOLD = 15;   // consecutive scrolls with zero new DOM URLs → END_OF_FEED
export const MAX_SCROLL_BUDGET_PER_QUERY = 300;
export const MAX_SCROLL_PHASE_MS = 8 * 60_000;   // budget for scroll phase
export const MAX_EXTRACT_PHASE_MS = 35 * 60_000; // budget for extraction phase (~100+ places at 15–20s each)
export const MAX_QUERY_DURATION_MS = MAX_SCROLL_PHASE_MS + MAX_EXTRACT_PHASE_MS; // 43 min combined ceiling
export const MAX_EXTRACTIONS_PER_QUERY = 200;
export const SEEN_IDS_RETAIN = 5000;
