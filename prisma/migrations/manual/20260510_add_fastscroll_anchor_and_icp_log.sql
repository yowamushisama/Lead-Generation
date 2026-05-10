-- Migration: add_fastscroll_anchor_and_icp_log
-- Purpose: Phase 1 of the intelligent scrape-resume system.
--   1. Extend CampaignScrapeCursor with tail/anchor fields for fast-scroll probe (Phase 2)
--      and reconciliation fields (Phase 3).
--   2. Add ICPProfileChangeLog table to track per-field diffs on ICP edits.
--
-- Apply via:
--   npx prisma db execute --file prisma/migrations/manual/20260510_add_fastscroll_anchor_and_icp_log.sql --schema prisma/schema.prisma
--   npm run prisma:generate
--
-- All ADD COLUMN IF NOT EXISTS with constant defaults — Postgres applies as catalog-only,
-- no table rewrite. Safe for large prod tables.

-- ── CampaignScrapeCursor extensions ──────────────────────────────────────────────────────────
ALTER TABLE "CampaignScrapeCursor"
  ADD COLUMN IF NOT EXISTS "tailIds"              TEXT[]            NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "anchorPlaceId"        TEXT,
  ADD COLUMN IF NOT EXISTS "keyword"              TEXT,
  ADD COLUMN IF NOT EXISTS "industry"             TEXT,
  ADD COLUMN IF NOT EXISTS "location"             TEXT,
  ADD COLUMN IF NOT EXISTS "lastEndReason"        TEXT,
  ADD COLUMN IF NOT EXISTS "fastScrollBudgetUsed" INTEGER           NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fastScrollLastUsed"   INTEGER           NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fastScrollHitRate"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "archived"             BOOLEAN           NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archivedAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedReason"       TEXT;

CREATE INDEX IF NOT EXISTS "CampaignScrapeCursor_campaignId_archived_idx"
  ON "CampaignScrapeCursor"("campaignId", "archived");

-- ── ICPProfileChangeLog ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ICPProfileChangeLog" (
  "id"             TEXT          NOT NULL,
  "profileId"      TEXT          NOT NULL,
  "organizationId" TEXT          NOT NULL,
  "changedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedBy"      TEXT,
  "fieldName"      TEXT          NOT NULL,
  "beforeValue"    JSONB,
  "afterValue"     JSONB,
  "fromVersion"    INTEGER       NOT NULL,
  "toVersion"      INTEGER       NOT NULL,

  CONSTRAINT "ICPProfileChangeLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ICPProfileChangeLog_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "ICPProfile"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ICPProfileChangeLog_profileId_changedAt_idx"
  ON "ICPProfileChangeLog"("profileId", "changedAt");

CREATE INDEX IF NOT EXISTS "ICPProfileChangeLog_organizationId_fieldName_changedAt_idx"
  ON "ICPProfileChangeLog"("organizationId", "fieldName", "changedAt");
