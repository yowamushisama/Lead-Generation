-- Migration: gmaps_run_logging
-- Adds per-run and per-query telemetry tables, extends CampaignScrapeCursor.
-- Apply with: psql $DATABASE_URL -f prisma/migrations/gmaps_run_logging.sql

-- ── 1. Extend CampaignScrapeCursor ───────────────────────────────────────────
ALTER TABLE "CampaignScrapeCursor"
  ADD COLUMN IF NOT EXISTS "seenExternalIds" TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "lastScrollDepth"  INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "duplicateWallHits" INTEGER NOT NULL DEFAULT 0;

-- ── 2. CampaignRunLog — one row per runCampaign() invocation ─────────────────
CREATE TABLE IF NOT EXISTS "CampaignRunLog" (
  "id"                    TEXT         NOT NULL,
  "runId"                 TEXT         NOT NULL,
  "campaignId"            TEXT         NOT NULL,
  "organizationId"        TEXT         NOT NULL,
  "trigger"               TEXT         NOT NULL,
  "startedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"           TIMESTAMP(3),
  "durationMs"            INTEGER,
  "status"                TEXT         NOT NULL DEFAULT 'RUNNING',
  "goalMaxLeads"          INTEGER      NOT NULL,
  "reachedGoal"           BOOLEAN      NOT NULL DEFAULT false,
  "endReason"             TEXT,
  "adaptersAttempted"     TEXT[]       NOT NULL DEFAULT '{}',
  "adaptersUsed"          TEXT[]       NOT NULL DEFAULT '{}',
  "adaptersSkipped"       JSONB        NOT NULL DEFAULT '[]',
  "candidatesYielded"     INTEGER      NOT NULL DEFAULT 0,
  "duplicatesAtAdapter"   INTEGER      NOT NULL DEFAULT 0,
  "duplicatesAtIngestion" INTEGER      NOT NULL DEFAULT 0,
  "newLeadsSaved"         INTEGER      NOT NULL DEFAULT 0,
  "enqueuedToPipeline"    INTEGER      NOT NULL DEFAULT 0,
  "errors"                INTEGER      NOT NULL DEFAULT 0,
  "errorSummary"          JSONB,
  "metadata"              JSONB,
  CONSTRAINT "CampaignRunLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CampaignRunLog"
  ADD CONSTRAINT "CampaignRunLog_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "CampaignRunLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignRunLog_runId_key" ON "CampaignRunLog"("runId");
CREATE INDEX IF NOT EXISTS "CampaignRunLog_organizationId_startedAt_idx" ON "CampaignRunLog"("organizationId", "startedAt");
CREATE INDEX IF NOT EXISTS "CampaignRunLog_campaignId_startedAt_idx"     ON "CampaignRunLog"("campaignId", "startedAt");
CREATE INDEX IF NOT EXISTS "CampaignRunLog_status_idx"                   ON "CampaignRunLog"("status");

-- ── 3. GmapsScrapeRunLog — one row per Google Maps query within a run ─────────
CREATE TABLE IF NOT EXISTS "GmapsScrapeRunLog" (
  "id"                     TEXT         NOT NULL,
  "runId"                  TEXT         NOT NULL,
  "campaignId"             TEXT         NOT NULL,
  "organizationId"         TEXT         NOT NULL,
  "queryKey"               TEXT         NOT NULL,
  "searchTerm"             TEXT         NOT NULL,
  "startedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"            TIMESTAMP(3),
  "durationMs"             INTEGER,
  "scrollAttempts"         INTEGER      NOT NULL DEFAULT 0,
  "candidateUrlsCollected" INTEGER      NOT NULL DEFAULT 0,
  "cursorCacheHits"        INTEGER      NOT NULL DEFAULT 0,
  "dbBatchDuplicates"      INTEGER      NOT NULL DEFAULT 0,
  "extractionFailures"     INTEGER      NOT NULL DEFAULT 0,
  "candidatesExtracted"    INTEGER      NOT NULL DEFAULT 0,
  "ingestionDuplicates"    INTEGER      NOT NULL DEFAULT 0,
  "newLeadsSaved"          INTEGER      NOT NULL DEFAULT 0,
  "endReason"              TEXT                  DEFAULT 'RUNNING',
  "errorSummary"           TEXT,
  "metadata"               JSONB,
  CONSTRAINT "GmapsScrapeRunLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GmapsScrapeRunLog"
  ADD CONSTRAINT "GmapsScrapeRunLog_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "GmapsScrapeRunLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "GmapsScrapeRunLog_organizationId_startedAt_idx" ON "GmapsScrapeRunLog"("organizationId", "startedAt");
CREATE INDEX IF NOT EXISTS "GmapsScrapeRunLog_campaignId_queryKey_idx"      ON "GmapsScrapeRunLog"("campaignId", "queryKey");
CREATE INDEX IF NOT EXISTS "GmapsScrapeRunLog_runId_idx"                    ON "GmapsScrapeRunLog"("runId");
