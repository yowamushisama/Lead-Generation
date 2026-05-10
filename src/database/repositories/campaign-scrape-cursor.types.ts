export interface ScrapeCursorData {
  lastRunAt: Date;
  lastScrollSteps: number;
  totalSeenDelta: number;
  lastNewCount: number;
  consecutiveZeroRuns: number;
  lastNewLeadAt: Date | null;
  exhausted: boolean;
  lastScrollDepth?: number;
  duplicateWallHits?: number;
}

export interface ScrapeCursorAnchorData {
  anchorPlaceId?: string | null;
  keyword?: string;
  industry?: string;
  location?: string;
  lastEndReason?: string;
  fastScrollLastUsed?: number;
  fastScrollBudgetDelta?: number;
  fastScrollHitRate?: number | null;
}

export const MAX_SEEN_IDS = 2000;
export const MAX_TAIL_IDS = 80;
