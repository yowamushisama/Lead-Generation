-- Migration: dedup partial indexes, Campaign.maxLeadsPerRun, CampaignScrapeCursor
-- Run this in Supabase SQL Editor.

-- 1. Per-run limit field on Campaign
ALTER TABLE "public"."Campaign"
  ADD COLUMN IF NOT EXISTS "maxLeadsPerRun" INTEGER;

-- 2. CampaignScrapeCursor table
CREATE TABLE IF NOT EXISTS "public"."CampaignScrapeCursor" (
  "id"                  TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "campaignId"          TEXT          NOT NULL,
  "source"              TEXT          NOT NULL,
  "queryKey"            TEXT          NOT NULL,
  "lastRunAt"           TIMESTAMP(3),
  "lastScrollSteps"     INTEGER       NOT NULL DEFAULT 8,
  "totalSeen"           INTEGER       NOT NULL DEFAULT 0,
  "lastNewCount"        INTEGER       NOT NULL DEFAULT 0,
  "consecutiveZeroRuns" INTEGER       NOT NULL DEFAULT 0,
  "lastNewLeadAt"       TIMESTAMP(3),
  "exhausted"           BOOLEAN       NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignScrapeCursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignScrapeCursor_campaignId_source_queryKey_key"
  ON "public"."CampaignScrapeCursor"("campaignId", "source", "queryKey");

CREATE INDEX IF NOT EXISTS "CampaignScrapeCursor_campaignId_source_idx"
  ON "public"."CampaignScrapeCursor"("campaignId", "source");

ALTER TABLE "public"."CampaignScrapeCursor"
  ADD CONSTRAINT "CampaignScrapeCursor_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Partial unique indexes on Lead (Prisma cannot model partial indexes in schema.prisma)
--    Belt-and-suspenders: the application-level dedup check is the primary guard.
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_placeId_organizationId_key"
  ON "public"."Lead"("placeId", "organizationId")
  WHERE "placeId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Lead_contentHash_organizationId_key"
  ON "public"."Lead"("contentHash", "organizationId")
  WHERE "contentHash" IS NOT NULL;
