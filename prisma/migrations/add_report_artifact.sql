-- Migration: Create ReportArtifact table
-- Run this in Supabase SQL Editor if the table does not exist.

CREATE TABLE IF NOT EXISTS "public"."ReportArtifact" (
    "id"             TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT          NOT NULL,
    "leadId"         TEXT          NOT NULL,
    "campaignId"     TEXT,
    "kind"           TEXT          NOT NULL,
    "version"        INTEGER       NOT NULL DEFAULT 1,
    "body"           TEXT          NOT NULL,
    "metadata"       JSONB         NOT NULL,
    "generatedBy"    TEXT,
    "generatedAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportArtifact_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one version per (lead, kind)
CREATE UNIQUE INDEX IF NOT EXISTS "ReportArtifact_leadId_kind_version_key"
    ON "public"."ReportArtifact"("leadId", "kind", "version");

-- Indexes
CREATE INDEX IF NOT EXISTS "ReportArtifact_organizationId_leadId_idx"
    ON "public"."ReportArtifact"("organizationId", "leadId");

CREATE INDEX IF NOT EXISTS "ReportArtifact_leadId_kind_idx"
    ON "public"."ReportArtifact"("leadId", "kind");

-- Foreign keys
ALTER TABLE "public"."ReportArtifact"
    ADD CONSTRAINT "ReportArtifact_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ReportArtifact"
    ADD CONSTRAINT "ReportArtifact_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ReportArtifact"
    ADD CONSTRAINT "ReportArtifact_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
