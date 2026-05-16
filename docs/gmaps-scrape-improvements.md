# Google Maps Scraping — Improvements & Operator Guide

## 1. Why This Changed

A manual campaign run requesting 200 leads returned `saved: 1, duplicates: 22`. Five root causes were identified:

**1. Silent adapter-level duplicate drop.** The adapter warm-loaded *all* existing place IDs for the org upfront and silently discarded matches before yielding. Operators could not distinguish "adapter saw 200 listings but 199 were duplicates" from "adapter only scrolled 22 listings."

**2. No persistent scroll progress.** `CampaignScrapeCursor` had no recent-seen ID cache, so reruns re-scrolled the same already-scraped listings from the top.

**3. Fixed, too-small scroll cap.** `defaultSteps = min(30, ceil(maxResults/3))` clamped scrolling to [8, 30] steps regardless of how many new listings the feed still had.

**4. No duplicate-wall detection.** When a query's geography was saturated, nearly every visible listing was a duplicate. The adapter had no logic to recognize this, stop early, or rotate to the next query.

**5. No per-run telemetry.** `LinkedInRun` existed for LinkedIn diagnostics; nothing equivalent existed for Google Maps or at the campaign level. Operators could not answer "what happened on date X?"

---

## 2. Architectural Principle

> **The runner owns the saved-lead goal. The adapter owns candidate discovery.**

Previously, the adapter tried to cap results itself (`maxResults`), which capped *candidates seen*, not *unique leads saved*. Now:

- The **runner** keeps consuming from `adapter.collect()` until `summary.saved >= goalMaxLeads`, or an adapter exhausts all queries, or a safety ceiling fires.
- The **adapter** scrolls, deduplicates per-scroll-batch via the DB, and yields candidates. It does not know about the campaign-level goal.

---

## 3. The Two New Log Tables

### 3.1 `CampaignRunLog` — one row per `runCampaign()` invocation

| Column | Type | Meaning |
|---|---|---|
| `runId` | `String` | UUID, also returned in the HTTP response |
| `campaignId` | `String` | FK to Campaign |
| `organizationId` | `String` | FK to Organization |
| `trigger` | `String` | `activation` / `scheduled` / `manual` |
| `startedAt` | `DateTime` | Wall clock when lock was acquired |
| `completedAt` | `DateTime?` | Null while running |
| `durationMs` | `Int?` | Total wall time |
| `status` | `String` | `RUNNING` → `COMPLETED` / `FAILED` / `LOCKED_OUT` |
| `goalMaxLeads` | `Int` | Resolved campaign-wide saved-lead target |
| `reachedGoal` | `Boolean` | `true` when `newLeadsSaved >= goalMaxLeads` |
| `endReason` | `String?` | See table below |
| `adaptersAttempted` | `String[]` | Every source the runner considered |
| `adaptersUsed` | `String[]` | Sources that actually yielded candidates |
| `adaptersSkipped` | `Json` | `[{ adapter, reason }]` — WHY each was skipped |
| `candidatesYielded` | `Int` | Total candidates consumed by runner (before ingestion) |
| `duplicatesAtAdapter` | `Int` | Dropped by cursor cache + batch DB check, BEFORE yielding |
| `duplicatesAtIngestion` | `Int` | Matched existing leads during `ingestRawLead()` |
| `newLeadsSaved` | `Int` | Unique new leads written to DB |
| `enqueuedToPipeline` | `Int` | Leads handed to BullMQ for AI processing |
| `errors` | `Int` | Ingestion or enqueue errors |

**`endReason` values:**

| Value | Meaning |
|---|---|
| `GOAL_REACHED` | `newLeadsSaved >= goalMaxLeads` — normal success |
| `ADAPTERS_EXHAUSTED` | All adapters finished without reaching goal |
| `SAFETY_LIMIT` | Safety ceiling hit: candidates × 5, max duration, or max errors |
| `ERROR` | Unhandled exception in `runCampaignLocked` |
| `LOCKED_OUT` | Another run was already in progress (status column) |

**Useful queries:**

```sql
-- All runs in last 7 days where goal was not reached, ordered by gap
SELECT run_id, campaign_id, goal_max_leads, new_leads_saved,
       goal_max_leads - new_leads_saved AS gap, end_reason
FROM campaign_run_logs
WHERE organization_id = '<org>'
  AND started_at > now() - interval '7 days'
  AND reached_goal = false
ORDER BY gap DESC;

-- Average duplicate rate per campaign
SELECT campaign_id,
       round(avg(duplicates_at_adapter::numeric / NULLIF(candidates_yielded + duplicates_at_adapter, 0) * 100), 1) AS pct_dups_at_adapter,
       round(avg(duplicates_at_ingestion::numeric / NULLIF(candidates_yielded, 0) * 100), 1) AS pct_dups_at_ingestion
FROM campaign_run_logs
WHERE organization_id = '<org>'
GROUP BY campaign_id;

-- Locked-out rows (concurrent run attempts)
SELECT run_id, campaign_id, trigger, started_at
FROM campaign_run_logs
WHERE organization_id = '<org>'
  AND status = 'LOCKED_OUT'
ORDER BY started_at DESC;
```

---

### 3.2 `GmapsScrapeRunLog` — one row per query within a Google Maps run

| Column | Type | Meaning |
|---|---|---|
| `runId` | `String` | Joins to `CampaignRunLog.runId` |
| `queryKey` | `String` | SHA-256(keyword\|industry\|location)[:16] |
| `searchTerm` | `String` | Human-readable search string |
| `startedAt` / `completedAt` | `DateTime` | Per-query wall time |
| `scrollAttempts` | `Int` | Number of scroll steps taken |
| `candidateUrlsCollected` | `Int` | Fresh URLs surviving cursor + DB dedup in collection phase |
| `cursorCacheHits` | `Int` | URLs skipped because they were in `seenExternalIds` cache |
| `dbBatchDuplicates` | `Int` | URLs skipped because DB already had the place |
| `extractionFailures` | `Int` | Detail-page navigations that returned no usable place |
| `candidatesExtracted` | `Int` | `RawLeadInput` records emitted to runner |
| `ingestionDuplicates` | `Int` | Runner-side: ingestion matched an existing lead |
| `newLeadsSaved` | `Int` | Runner-side: new lead written to DB |
| `endReason` | `String?` | See table below |

**`endReason` values:**

| Value | Meaning |
|---|---|
| `END_OF_FEED` | Scroll reached bottom (no new DOM cards for 3 consecutive steps) |
| `DUPLICATE_WALL` | 5 consecutive scroll batches were 100% duplicate URLs |
| `EXTRACTION_BUDGET` | Hit `MAX_EXTRACTIONS_PER_QUERY` (150 by default) |
| `QUERY_TIMEOUT` | Query exceeded `MAX_QUERY_DURATION_MS` (5 min by default) |
| `RETRY_EXHAUSTED` | Playwright navigation failed after 3 attempts |
| `RUN_GOAL_REACHED` | Runner cancelled because campaign goal was met |
| `RUN_SAFETY_LIMIT` | Runner cancelled because a safety ceiling fired |
| `CANCELLED_BY_RUNNER` | Runner broke the iterator without setting a specific reason |
| `ERROR` | Unexpected exception inside the query |

**Useful queries:**

```sql
-- For a given run, which queries hit DUPLICATE_WALL?
SELECT query_key, search_term, scroll_attempts,
       cursor_cache_hits, db_batch_duplicates, candidates_extracted, end_reason
FROM gmaps_scrape_run_logs
WHERE run_id = '<runId>'
  AND end_reason = 'DUPLICATE_WALL';

-- Queries where cursor cache is doing its job (high cache-hit ratio)
SELECT query_key, search_term,
       cursor_cache_hits,
       candidates_extracted,
       round(cursor_cache_hits::numeric / NULLIF(cursor_cache_hits + candidates_extracted, 0) * 100, 1) AS cache_hit_pct
FROM gmaps_scrape_run_logs
WHERE organization_id = '<org>'
  AND cursor_cache_hits > 10
ORDER BY cache_hit_pct DESC;

-- Sanity-check: per-run sum should equal CampaignRunLog.new_leads_saved
SELECT run_id, sum(new_leads_saved) AS sum_from_queries
FROM gmaps_scrape_run_logs
WHERE organization_id = '<org>'
GROUP BY run_id;
```

---

## 4. Counter Reconciliation

The following invariant holds for every completed run:

```
candidatesYielded = duplicatesAtIngestion + newLeadsSaved + errors
```

`duplicatesAtAdapter` is **additional** — those candidates were dropped before being yielded, so they are not part of the equation.

The invariant holds because `candidatesYielded` is incremented before the ingestion try/catch. If ingestion succeeds it adds to `newLeadsSaved` or `duplicatesAtIngestion`; if it throws it adds to `errors`. The safety ceiling checks fire after the current candidate is fully processed, so they never split a candidate between the counter and its resolution.

`RawLeadInput.name` is required by contract (`lead-input.interface.ts`). Adapter-side invalid candidates (extraction failures, empty name, "Unknown Business") are filtered before yielding and counted in `GmapsScrapeRunLog.extractionFailures`, never in `candidatesYielded`.

---

## 5. Cursor Semantics

`CampaignScrapeCursor` stores per-query state:

| Field | Meaning |
|---|---|
| `seenExternalIds` | **FIFO cache** (up to 2,000 IDs) of recently seen placeIds/URLs. Optimization hint only — Google Maps has no reliable offset or page token, so reruns still navigate to the search URL and scroll from the top. The cache lets the collection phase skip known IDs cheaply without a DB query. |
| `lastScrollDepth` | Number of scroll steps taken on the last run. Advisory; used to tune the next run's scroll budget. |
| `duplicateWallHits` | How many times this query ended with `DUPLICATE_WALL`. High value → geography is saturated; consider adding new keywords or locations. |
| `exhausted` | `true` when `consecutiveZeroRuns >= 3 AND duplicateWallHits >= 2`. Manual runs ignore this flag (`ignoreExhausted: true`). |

The FIFO cache is written by `cursorRepository.appendSeen()`, which truncates to `SEEN_IDS_RETAIN = 2000` IDs.

---

## 6. Tuning Knobs

### Per-query (adapter-side safety ceilings — NOT the saved-lead goal)

| Env var / constant | Default | When to change |
|---|---|---|
| `DUPLICATE_WALL_THRESHOLD` | 5 | Consecutive scroll batches that are 100% duplicates before stopping early. Lower → stop sooner on saturated geographies. |
| `NO_NEW_LISTINGS_THRESHOLD` | 3 | Consecutive scrolls with zero new DOM URLs → `END_OF_FEED`. |
| `MAX_SCROLL_BUDGET_PER_QUERY` | 80 | Hard scroll-step ceiling per query. Replaces the old [8, 30] clamp. |
| `MAX_QUERY_DURATION_MS` | 300,000 (5 min) | Wallclock cap per query. |
| `MAX_EXTRACTIONS_PER_QUERY` | 150 | Detail-page navigations per query. Prevents one saturated query from blocking the runner's safety checks for too long. |
| `SEEN_IDS_RETAIN` | 2,000 | FIFO cap for cursor's `seenExternalIds`. |

### Per-run (runner)

| Env var | Default | Meaning |
|---|---|---|
| `CAMPAIGN_RUN_GOAL_MAX_LEADS` | 100 | **Campaign-wide** saved-lead target. Replaces the deprecated `CAMPAIGN_RUN_MAX_RESULTS_PER_ADAPTER`. |
| `CAMPAIGN_RUN_SAFETY_MULTIPLIER` | 5 | `maxCandidatesPerRun = goal × multiplier`. Safety ceiling to prevent infinite loops when almost everything is a duplicate. |
| `CAMPAIGN_RUN_MAX_DURATION_MS` | 1,800,000 (30 min) | Total wallclock cap for a single run. |
| `CAMPAIGN_RUN_MAX_ERRORS` | 25 | Max ingestion/enqueue errors before aborting. |

### Deprecated: `CAMPAIGN_RUN_MAX_RESULTS_PER_ADAPTER`

This env var has been superseded. If set, it is still read as a fallback with a deprecation warning logged:

```
CAMPAIGN_RUN_MAX_RESULTS_PER_ADAPTER is deprecated. Rename to CAMPAIGN_RUN_GOAL_MAX_LEADS.
This env var now sets a campaign-wide saved-lead goal, not a per-adapter candidate cap.
```

**Semantic shift:** the old value was a per-adapter *candidate* cap. The new `CAMPAIGN_RUN_GOAL_MAX_LEADS` is a *saved-lead* target that the runner pursues across all adapters. If your `.env` has `CAMPAIGN_RUN_MAX_RESULTS_PER_ADAPTER=50` and you migrate to `CAMPAIGN_RUN_GOAL_MAX_LEADS=50`, the run will now keep scraping until 50 *unique new leads* are saved, not until 50 *candidates* are seen.

---

## 7. Operator Runbook: "Campaign Requested 200 Leads, Got 5"

**Step 1 — Get the run record.**

```sql
SELECT * FROM campaign_run_logs
WHERE campaign_id = '<id>'
ORDER BY started_at DESC
LIMIT 1;
```

Read `end_reason`, `new_leads_saved`, `duplicates_at_adapter`, `duplicates_at_ingestion`, `candidates_yielded`.

Counter check: `candidates_yielded` should equal `duplicates_at_ingestion + new_leads_saved + errors`.

**Step 2 — Interpret the top-level gap.**

| Observation | Diagnosis |
|---|---|
| `end_reason = ADAPTERS_EXHAUSTED`, `duplicates_at_ingestion` is high | Leads already in DB from prior runs. Add new keywords/locations. |
| `end_reason = ADAPTERS_EXHAUSTED`, `duplicates_at_adapter` is high | Cursor cache is recognizing previously scraped URLs. Geography may be saturated. |
| `end_reason = SAFETY_LIMIT` | `candidatesYielded` hit `goal × 5`, max duration, or max errors. Investigate per-query logs. |
| `end_reason = GOAL_REACHED` | Success — `new_leads_saved >= goal_max_leads`. |
| `status = LOCKED_OUT` | Another run was already active. |

**Step 3 — Drill into per-query telemetry.**

```sql
SELECT query_key, search_term, scroll_attempts,
       cursor_cache_hits, db_batch_duplicates,
       candidates_extracted, ingestion_duplicates, new_leads_saved,
       end_reason, duration_ms
FROM gmaps_scrape_run_logs
WHERE run_id = '<runId>'
ORDER BY new_leads_saved ASC;
```

| Per-query pattern | Diagnosis |
|---|---|
| `end_reason = DUPLICATE_WALL` | This keyword + location is saturated. Retire or replace it. |
| `cursor_cache_hits` is high | Cursor cache is healthy and working. |
| `db_batch_duplicates` is high, `cursor_cache_hits` is low | Leads exist in DB but cache hasn't warmed up yet (normal on first few reruns). |
| `candidates_extracted = 0`, `end_reason = END_OF_FEED` | Google Maps returned very few results for this search term. Try a broader keyword. |
| `end_reason = RETRY_EXHAUSTED` | Playwright navigation failed 3×. Check for IP blocks or selector drift. |

**Step 4 — Cross-reference cursor exhaustion.**

```sql
SELECT query_key, duplicate_wall_hits, consecutive_zero_runs, exhausted, last_run_at
FROM campaign_scrape_cursors
WHERE campaign_id = '<id>'
  AND source = 'google_maps'
ORDER BY duplicate_wall_hits DESC;
```

Queries with `exhausted = true` and `duplicate_wall_hits >= 2` are saturated. Expand the campaign's keywords or locations to unlock new search terms.
