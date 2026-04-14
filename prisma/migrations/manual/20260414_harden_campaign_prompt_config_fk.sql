-- Ensure campaign prompt config links are tenant-scoped at the database layer.

CREATE UNIQUE INDEX IF NOT EXISTS "PromptConfig_organizationId_id_key"
  ON "PromptConfig" ("organizationId", "id");

ALTER TABLE "Campaign"
  DROP CONSTRAINT IF EXISTS "Campaign_promptConfigId_fkey";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Campaign_organizationId_promptConfigId_fkey'
  ) THEN
    ALTER TABLE "Campaign"
      ADD CONSTRAINT "Campaign_organizationId_promptConfigId_fkey"
      FOREIGN KEY ("organizationId", "promptConfigId")
      REFERENCES "PromptConfig" ("organizationId", "id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;
