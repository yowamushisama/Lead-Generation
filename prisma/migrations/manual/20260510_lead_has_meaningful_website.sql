-- Add hasMeaningfulWebsite column to Lead.
-- Invariant (single source of truth — must match SOCIAL_HOSTS in gmaps-filter.ts):
--   true  = website evaluates to a real business domain
--   false = evaluated website is absent, blank, invalid, or a social/aggregator/messaging host
--   null  = adapter provided no website signal (legacy rows not in backfill scope are left null)
--
-- Social host allowlist (keep in sync with SOCIAL_HOSTS in src/adapters/google-maps/gmaps-filter.ts):
--   facebook.com, instagram.com, linktr.ee, linktree.com, tiktok.com,
--   wa.me, whatsapp.com, t.me, telegram.me, m.me

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "hasMeaningfulWebsite" BOOLEAN;

-- Do not use CONCURRENTLY here: many migration runners and SQL consoles wrap
-- scripts in a transaction, and PostgreSQL forbids CREATE INDEX CONCURRENTLY
-- inside transaction blocks.
CREATE INDEX IF NOT EXISTS "Lead_organizationId_source_hasMeaningfulWebsite_idx"
  ON "Lead" ("organizationId", "source", "hasMeaningfulWebsite");

-- Backfill existing rows that have a website value. NULL website rows stay NULL because
-- legacy adapters may not have evaluated website presence at all.
-- Protocol-less URLs (e.g. "example.com/path") are handled by conditionally prepending https://.

UPDATE "Lead"
SET "hasMeaningfulWebsite" = CASE
  WHEN trim("website") = ''
    THEN false
  WHEN
    -- Normalize host: strip protocol if present, take host portion, lowercase, strip www.
    lower(
      regexp_replace(
        split_part(
          regexp_replace(
            regexp_replace(lower(trim("website")), '^[a-z][a-z0-9+.\-]*://', ''),
            '[/?#].*$', ''
          ),
          ':', 1
        ),
        '^www\.', ''
      )
    ) IN (
      'facebook.com', 'instagram.com', 'linktr.ee', 'linktree.com', 'tiktok.com',
      'wa.me', 'whatsapp.com', 't.me', 'telegram.me', 'm.me'
    )
    THEN false
  WHEN
    -- Empty normalized host → invalid URL
    lower(
      regexp_replace(
        split_part(
          regexp_replace(
            regexp_replace(lower(trim("website")), '^[a-z][a-z0-9+.\-]*://', ''),
            '[/?#].*$', ''
          ),
          ':', 1
        ),
        '^www\.', ''
      )
    ) = ''
    THEN false
  ELSE true
END
WHERE "website" IS NOT NULL;
  
