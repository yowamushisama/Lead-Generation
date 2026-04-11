-- ============================================================
-- Lead Generation Engine — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table if not exists public."Organization" (
  id                    text        primary key default gen_random_uuid()::text,
  name                  text        not null,
  slug                  text        not null unique,
  tier                  text        not null default 'free',
  "maxLeadsPerDay"      integer     not null default 50,
  "maxAiTokensPerMonth" bigint      not null default 1000000,
  "classificationModel" text        not null default 'gpt-4o-mini',
  "personalizationModel" text       not null default 'gpt-4o',
  "serviceOffering"     text,
  "uniqueValue"         text,
  "positioningPrompt"   text,
  "createdAt"           timestamptz not null default now(),
  "updatedAt"           timestamptz not null default now()
);

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public."User" (
  id               text        primary key default gen_random_uuid()::text,
  email            text        not null unique,
  name             text,
  role             text        not null default 'member',
  "supabaseUserId" text        not null unique,
  "organizationId" text        not null references public."Organization"(id),
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);
create index if not exists "User_organizationId_idx" on public."User"("organizationId");

-- ============================================================
-- ICP PROFILES
-- ============================================================
create table if not exists public."ICPProfile" (
  id                 text        primary key default gen_random_uuid()::text,
  "organizationId"   text        not null references public."Organization"(id),
  name               text        not null,
  version            integer     not null default 1,
  config             jsonb,
  "targetRoles"      jsonb,
  "targetIndustries" jsonb,
  "targetStages"     jsonb,
  "targetLocations"  jsonb,
  "buyerSignals"     jsonb,
  "urgencySignals"   jsonb,
  "budgetSignals"    jsonb,
  "learnedWeights"   jsonb,
  "conversionRate"   double precision,
  "isActive"         boolean     not null default true,
  "createdAt"        timestamptz not null default now(),
  "updatedAt"        timestamptz not null default now()
);
create index if not exists "ICPProfile_organizationId_isActive_idx" on public."ICPProfile"("organizationId", "isActive");

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table if not exists public."Campaign" (
  id                  text        primary key default gen_random_uuid()::text,
  "organizationId"    text        not null references public."Organization"(id),
  name                text        not null,
  description         text,
  "icpProfileId"      text        references public."ICPProfile"(id),
  settings            jsonb,
  "icpConfig"         jsonb,
  keywords            jsonb,
  sources             jsonb,
  "targetLocations"   jsonb,
  "targetIndustries"  jsonb,
  "scoringWeights"    jsonb,
  "positioningPrompt" text,
  "leadsGenerated"    integer     not null default 0,
  "messagesSent"      integer     not null default 0,
  replies             integer     not null default 0,
  meetings            integer     not null default 0,
  conversions         integer     not null default 0,
  "isActive"          boolean     not null default true,
  status              text        not null default 'ACTIVE',
  "createdAt"         timestamptz not null default now(),
  "updatedAt"         timestamptz not null default now()
);
create index if not exists "Campaign_organizationId_status_idx" on public."Campaign"("organizationId", status);

-- ============================================================
-- LEADS
-- ============================================================
create table if not exists public."Lead" (
  id                   text        primary key default gen_random_uuid()::text,
  "organizationId"     text        not null references public."Organization"(id),
  "externalId"         text,
  source               text        not null,
  "sourceUrl"          text,
  "sourceType"         text        not null default 'intent',
  name                 text        not null,
  headline             text,
  bio                  text,
  role                 text,
  company              text,
  "companySize"        text,
  industry             text,
  location             text,
  email                text,
  phone                text,
  website              text,
  "originalContent"    text,
  -- Intent
  "intentType"         text,
  "intentUrgency"      text,
  "intentConfidence"   double precision,
  "isBuyer"            boolean     not null default false,
  "intentReasoning"    text,
  "painPoints"         jsonb,
  fears                jsonb,
  desires              jsonb,
  "budgetSignal"       text,
  "hiringIntent"       boolean     not null default false,
  -- ICP enrichment
  "icpAttributes"      jsonb,
  "companyStage"       text,
  "technicalLevel"     text,
  -- Scoring
  score                integer     not null default 0,
  "scoreBreakdown"     jsonb,
  tier                 text        not null default 'COLD',
  -- Personalization
  "personalizationData" jsonb,
  "personalContext"    jsonb,
  psychology           jsonb,
  positioning          jsonb,
  "toneProfile"        text,
  "recommendedChannel" text,
  -- Google Maps
  "placeId"            text,
  rating               double precision,
  "reviewCount"        integer,
  "businessType"       text,
  -- Status
  status               text        not null default 'NEW',
  -- GDPR
  "consentBasis"       text        not null default 'LEGITIMATE_INTEREST',
  "optedOut"           boolean     not null default false,
  "optedOutAt"         timestamptz,
  "dataExpiresAt"      timestamptz,
  "contentHash"        text,
  -- Relations
  "campaignId"         text        references public."Campaign"(id),
  "createdAt"          timestamptz not null default now(),
  "updatedAt"          timestamptz not null default now(),

  unique ("externalId", source, "organizationId")
);
create index if not exists "Lead_organizationId_tier_status_idx" on public."Lead"("organizationId", tier, status);
create index if not exists "Lead_organizationId_score_idx"       on public."Lead"("organizationId", score);
create index if not exists "Lead_organizationId_source_idx"      on public."Lead"("organizationId", source);
create index if not exists "Lead_contentHash_organizationId_idx" on public."Lead"("contentHash", "organizationId");

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists public."Message" (
  id                text        primary key default gen_random_uuid()::text,
  "organizationId"  text        not null references public."Organization"(id),
  "leadId"          text        not null references public."Lead"(id) on delete cascade,
  "campaignId"      text        references public."Campaign"(id),
  channel           text        not null,
  subject           text,
  body              text        not null,
  type              text        not null default 'OUTREACH',
  "personalContext" jsonb,
  status            text        not null default 'DRAFT',
  "spamScore"       double precision,
  "uniquenessScore" double precision,
  "burntPatterns"   jsonb,
  "promptVersion"   text,
  "aiModel"         text,
  "aiTokensUsed"    integer,
  "approvedBy"      text,
  "approvedAt"      timestamptz,
  "sentAt"          timestamptz,
  "repliedAt"       timestamptz,
  "generatedAt"     timestamptz not null default now(),
  metadata          jsonb,
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now()
);
create index if not exists "Message_organizationId_status_idx" on public."Message"("organizationId", status);
create index if not exists "Message_leadId_idx"                on public."Message"("leadId");
create index if not exists "Message_campaignId_idx"            on public."Message"("campaignId");

-- ============================================================
-- CONVERSATIONS
-- ============================================================
create table if not exists public."Conversation" (
  id                text        primary key default gen_random_uuid()::text,
  "organizationId"  text        not null references public."Organization"(id),
  "leadId"          text        not null references public."Lead"(id) on delete cascade,
  channel           text        not null default 'linkedin-dm',
  messages          jsonb       not null default '[]',
  "messageCount"    integer     not null default 0,
  "lastMessageAt"   timestamptz not null default now(),
  "suggestedReply"  text,
  "objectionType"   text,
  sentiment         text,
  "closingStrategy" text,
  status            text        not null default 'ACTIVE',
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now()
);
create index if not exists "Conversation_organizationId_status_idx" on public."Conversation"("organizationId", status);
create index if not exists "Conversation_leadId_idx"                on public."Conversation"("leadId");

-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================
create table if not exists public."AnalyticsEvent" (
  id               text        primary key default gen_random_uuid()::text,
  "organizationId" text        not null references public."Organization"(id),
  "eventType"      text        not null,
  "leadId"         text,
  "campaignId"     text,
  data             jsonb,
  "entityType"     text,
  "entityId"       text,
  metadata         jsonb,
  "occurredAt"     timestamptz not null default now(),
  "createdAt"      timestamptz not null default now()
);
create index if not exists "AnalyticsEvent_organizationId_eventType_createdAt_idx" on public."AnalyticsEvent"("organizationId", "eventType", "createdAt");
create index if not exists "AnalyticsEvent_leadId_idx"                             on public."AnalyticsEvent"("leadId");

-- ============================================================
-- USAGE RECORDS
-- ============================================================
create table if not exists public."UsageRecord" (
  id                text    primary key default gen_random_uuid()::text,
  "organizationId"  text    not null references public."Organization"(id),
  date              date    not null,
  "aiTokensUsed"    bigint  not null default 0,
  "aiCostCents"     integer not null default 0,
  "leadsProcessed"  integer not null default 0,
  "scrapeRequests"  integer not null default 0,
  "scrapesExecuted" integer not null default 0,
  "apiCallsMade"    integer not null default 0,
  "updatedAt"       timestamptz not null default now(),

  unique ("organizationId", date)
);
create index if not exists "UsageRecord_organizationId_date_idx" on public."UsageRecord"("organizationId", date);

-- ============================================================
-- AUTO-UPDATE updatedAt via trigger
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

do $$ declare
  t text;
begin
  foreach t in array array[
    'Organization','User','ICPProfile','Campaign','Lead',
    'Message','Conversation','UsageRecord'
  ] loop
    execute format(
      'create trigger handle_updated_at before update on public.%I
       for each row execute function public.handle_updated_at()',
      t
    );
  end loop;
end $$;
