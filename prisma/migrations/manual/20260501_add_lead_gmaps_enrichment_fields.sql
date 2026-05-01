-- Migration: Add Google Maps scraper + enrichment fields to Lead table.
-- Safe to run multiple times (all ADD COLUMN IF NOT EXISTS).

-- ============================================================================
-- 1. Google Maps discovery fields (scraped by the Playwright adapter)
-- ============================================================================

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "businessHours"   JSONB,
  ADD COLUMN IF NOT EXISTS "lastReviewAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "googleTypes"     JSONB,
  ADD COLUMN IF NOT EXISTS "socialHandles"   JSONB;

-- ============================================================================
-- 2. Website enrichment fields (populated by WebsiteEnricherStage)
-- ============================================================================

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "websiteAudit"      JSONB,
  ADD COLUMN IF NOT EXISTS "enrichmentStatus"  TEXT;

-- ============================================================================
-- 3. Indexes
-- ============================================================================

-- Fast lookup of leads that still need enrichment
CREATE INDEX IF NOT EXISTS "Lead_enrichmentStatus_idx"
  ON "Lead" ("organizationId", "enrichmentStatus")
  WHERE "enrichmentStatus" IS NULL OR "enrichmentStatus" != 'OK';
