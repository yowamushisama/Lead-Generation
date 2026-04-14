-- Migration: Align prompt-config schema with the reusable prompt library design.
-- Run this against your PostgreSQL / Supabase database when DB access is available.
-- Intended to be safe to run multiple times.

-- ============================================================================
-- 1. Create PromptConfig table in its current shape if it does not exist yet
-- ============================================================================

CREATE TABLE IF NOT EXISTS "PromptConfig" (
  "id"                            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId"                TEXT        NOT NULL,

  -- Library metadata
  "name"                          TEXT        NOT NULL DEFAULT 'Untitled Prompt Config',
  "description"                   TEXT,
  "status"                        TEXT        NOT NULL DEFAULT 'active',

  -- Positioning
  "companyDescription"            TEXT,
  "coreOffer"                     TEXT,
  "targetPersona"                 TEXT,
  "mainPainSolved"                TEXT,
  "mainOutcomePromised"           TEXT,
  "proofPoints"                   JSONB,

  -- Voice & CTA
  "preferredTone"                 TEXT        NOT NULL DEFAULT 'professional',
  "customToneInstructions"        TEXT,
  "ctaStyle"                      TEXT        NOT NULL DEFAULT 'reply_question',
  "customCta"                     TEXT,

  -- Guardrails
  "forbiddenPhrases"              JSONB,
  "forbiddenClaims"               JSONB,
  "complianceNotes"               TEXT,

  -- System prompt overrides
  "personalizationPromptOverride" TEXT,
  "outreachPromptOverride"        TEXT,

  -- Versioning
  "version"                       INTEGER     NOT NULL DEFAULT 1,
  "history"                       JSONB,

  "createdAt"                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"                     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "PromptConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromptConfig_organizationId_fkey"
    FOREIGN KEY ("organizationId")
    REFERENCES "Organization" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ============================================================================
-- 2. Bring an old PromptConfig table forward to the current schema
-- ============================================================================

ALTER TABLE "PromptConfig"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "companyDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "coreOffer" TEXT,
  ADD COLUMN IF NOT EXISTS "targetPersona" TEXT,
  ADD COLUMN IF NOT EXISTS "mainPainSolved" TEXT,
  ADD COLUMN IF NOT EXISTS "mainOutcomePromised" TEXT,
  ADD COLUMN IF NOT EXISTS "proofPoints" JSONB,
  ADD COLUMN IF NOT EXISTS "preferredTone" TEXT,
  ADD COLUMN IF NOT EXISTS "customToneInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "ctaStyle" TEXT,
  ADD COLUMN IF NOT EXISTS "customCta" TEXT,
  ADD COLUMN IF NOT EXISTS "forbiddenPhrases" JSONB,
  ADD COLUMN IF NOT EXISTS "forbiddenClaims" JSONB,
  ADD COLUMN IF NOT EXISTS "complianceNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "personalizationPromptOverride" TEXT,
  ADD COLUMN IF NOT EXISTS "outreachPromptOverride" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER,
  ADD COLUMN IF NOT EXISTS "history" JSONB,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;

UPDATE "PromptConfig"
SET
  "name" = COALESCE(NULLIF("name", ''), 'Migrated Prompt Config'),
  "status" = COALESCE("status", 'active'),
  "preferredTone" = COALESCE("preferredTone", 'professional'),
  "ctaStyle" = COALESCE("ctaStyle", 'reply_question'),
  "version" = COALESCE("version", 1),
  "history" = COALESCE("history", '[]'::jsonb),
  "createdAt" = COALESCE("createdAt", now()),
  "updatedAt" = COALESCE("updatedAt", now());

ALTER TABLE "PromptConfig"
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "preferredTone" SET DEFAULT 'professional',
  ALTER COLUMN "preferredTone" SET NOT NULL,
  ALTER COLUMN "ctaStyle" SET DEFAULT 'reply_question',
  ALTER COLUMN "ctaStyle" SET NOT NULL,
  ALTER COLUMN "version" SET DEFAULT 1,
  ALTER COLUMN "version" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- ============================================================================
-- 3. Add campaign/message columns required by the reusable prompt library model
-- ============================================================================

ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "promptConfigId" TEXT,
  ADD COLUMN IF NOT EXISTS "promptOverrides" JSONB;

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "promptConfigId" TEXT,
  ADD COLUMN IF NOT EXISTS "promptVersion" TEXT;

-- ============================================================================
-- 4. Backfill old PromptConfig.campaignId ownership into Campaign.promptConfigId
--    This only runs if the old one-to-one column still exists.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PromptConfig'
      AND column_name = 'campaignId'
  ) THEN
    EXECUTE '
      UPDATE "Campaign" c
      SET "promptConfigId" = pc."id"
      FROM "PromptConfig" pc
      WHERE pc."campaignId" = c."id"
        AND c."promptConfigId" IS NULL
    ';
  END IF;
END $$;

-- ============================================================================
-- 5. Add indexes and foreign keys used by the current app code
-- ============================================================================

CREATE INDEX IF NOT EXISTS "PromptConfig_organizationId_status_idx"
  ON "PromptConfig" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "Campaign_promptConfigId_idx"
  ON "Campaign" ("promptConfigId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Campaign_promptConfigId_fkey'
  ) THEN
    ALTER TABLE "Campaign"
      ADD CONSTRAINT "Campaign_promptConfigId_fkey"
      FOREIGN KEY ("promptConfigId")
      REFERENCES "PromptConfig" ("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 6. Remove obsolete one-to-one PromptConfig.campaignId linkage from old schema
-- ============================================================================

ALTER TABLE "PromptConfig"
  DROP CONSTRAINT IF EXISTS "PromptConfig_campaignId_fkey";

ALTER TABLE "PromptConfig"
  DROP CONSTRAINT IF EXISTS "PromptConfig_campaignId_key";

ALTER TABLE "PromptConfig"
  DROP COLUMN IF EXISTS "campaignId";

