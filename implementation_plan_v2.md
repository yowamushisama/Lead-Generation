# AI Intent-Based Client Acquisition Engine — MVP Implementation Plan (v2)

## 1. Product Vision

A **fully automated, multi-pipeline client acquisition system** that detects high-intent buyers across social platforms and local business directories, enriches profiles against a dynamic ICP model, scores them deterministically, generates deeply personalized outreach, and feeds conversion data back to continuously improve targeting.

> **One-liner:** "Find people already looking for your service and help you close them — automatically."

**Deployment modes:**
- **Multi-tenant SaaS** — Multiple organizations, isolated data, per-org configuration
- **Single-tenant self-hosted** — One organization, simpler setup, `organizationId` defaults to a system constant

---

## 2. Critical Evaluation — Risks & Mitigations

> [!CAUTION]
> ### Risk 1: LinkedIn Scraping is Legally Fragile
> LinkedIn actively sues scrapers, bans accounts, and rate-limits aggressively. A LinkedIn-only product is a single point of failure.
>
> **Fix:** Abstract data collection behind a **Source Adapter interface**. LinkedIn is ONE adapter. We also build Google Maps, Twitter/X, Reddit, IndieHackers, CSV import, and webhook adapters. The system is **platform-agnostic by design**. Degradation mode keeps system functional if any adapter goes down.

> [!CAUTION]
> ### Risk 2: False Positive Intent — "Research" ≠ "Ready to Buy"
> Someone posting "looking for a developer" might be venting, may have already hired, or could be a competitor.
>
> **Fix:** Multi-signal validation. A single post is NOT enough. Cross-reference recency (< 48hrs), profile signals (founder/decision-maker?), activity pattern (still responding?), and historical data. **Confidence threshold of 0.80** — only high-confidence buyers proceed.

> [!WARNING]
> ### Risk 3: AI Messages Still Feel Like Spam
> Every tool now generates "personalized" outreach. Buyers are fatigued.
>
> **Fix:** Add a **4th personalization layer: Anti-Pattern Detection**. Before sending, AI checks messages against burnt patterns (overused openers, cliché CTAs). Reject if similarity > 0.6. Enforce message diversity — no two messages in a campaign share the same structure.

> [!WARNING]
> ### Risk 4: No Feedback = Flying Blind
> Without tracking what converts, the system degrades over time.
>
> **Fix:** Feedback loop is **Phase 1 core**. Every lead is tracked: Generated → Sent → Replied → Meeting → Closed. Data feeds back into scoring weights and ICP refinement automatically.

> [!IMPORTANT]
> ### Risk 5: Cold Outreach Deliverability is Declining
> Email spam filters are aggressive. LinkedIn DMs have low acceptance from strangers.
>
> **Fix:** System recommends **optimal channel per lead**. Multi-touch strategy: LinkedIn comment (warm-up) → DM, Twitter reply → DM, Reddit value comment → DM. Not blast-and-pray.

> [!IMPORTANT]
> ### Risk 6: GDPR/Privacy Compliance is Non-Negotiable
>
> **Fix:** Legitimate interest basis with documented LIA. Auto-delete after 90 days if no engagement. Opt-out / right-to-delete endpoints. Data minimization — store only what's needed.

> [!NOTE]
> ### Risk 7: LLMs Are Bad at Math
> Using AI to output a "lead score" is unreliable and non-reproducible.
>
> **Fix:** Lead scoring is **100% deterministic** — rule-based with weighted factors. AI extracts attributes (is this person a founder? → yes/no), but scoring MATH is done by code. Reproducible, debuggable, tunable.

> [!NOTE]
> ### Risk 8: Full Automation = Embarrassing Messages
>
> **Fix:** Human-in-the-loop checkpoints. HOT leads (score > 20): require human approval. WARM leads (10-20): auto-queue with review window. Dashboard shows all pending messages for approve/edit/reject.

> [!WARNING]
> ### Risk 9: Google Maps Leads Have No Intent Signal
> Unlike LinkedIn (where someone posts "I need a developer"), Google Maps gives you businesses that merely *exist*.
>
> **Fix:** Dual scoring tracks. **Intent-based leads** (LinkedIn, Twitter, Reddit) use the full intent+ICP scoring model. **Discovery-based leads** (Google Maps) use an ICP-fit scoring model focused on industry match, company size, location, and online presence signals. Outreach templates differ accordingly — intent leads get contextual messages, discovery leads get value-proposition cold outreach.

> [!CAUTION]
> ### Risk 10: Multi-Tenant Cost Blindspot
> With multiple clients, AI API costs multiply. One heavy client can blow your budget.
>
> **Fix:** Per-organization usage metering from Day 1. Track AI tokens consumed, scrapes executed, and leads processed per org. Set usage limits per tier.

---

## 3. Final Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Backend Framework** | NestJS (TypeScript) | Module-based architecture, built-in DI, decorators for queues/cron/validation, TypeScript-native. Perfect for pipeline stages as independent modules. |
| **Database** | Supabase (PostgreSQL) | Managed Postgres, built-in auth, Row Level Security for multi-tenancy, real-time subscriptions, generous free tier (500MB). |
| **ORM** | Prisma | Type-safe queries, auto-generated types, excellent migration system, works with Supabase Postgres. |
| **Queue** | BullMQ (Redis-backed) | `@nestjs/bullmq` integration. Each pipeline stage is a job. Built-in retry, delay, rate-limiting, priority queues. |
| **Cache / Redis** | Upstash Redis | Cloud-hosted, generous free tier (10K commands/day), no Docker needed. Rate limit tracking, session data, dedup. |
| **AI Providers** | Configurable: OpenAI + Claude | Per-task configuration. GPT-4o-mini or Claude Haiku for classification (cheap). GPT-4o or Claude Sonnet for personalization (quality). Switchable per org. |
| **Vector Store** | pgvector (Supabase extension) | Anti-pattern detection + message similarity. No separate service needed. |
| **Scraping** | Playwright + Stealth | LinkedIn scraping with human behavior simulation, fingerprint randomization, proxy rotation. |
| **Google Maps** | Google Places API | Business discovery by industry + location. $200/mo free credit. |
| **Dashboard (Phase 4)** | Next.js | SSR, API routes, Vercel deployment, React ecosystem. |
| **Deployment** | Railway (backend) + Vercel (dashboard) | No Docker. Railway supports NestJS + Playwright. Vercel free for Next.js. |
| **Monitoring** | Structured logging + health checks | Per-adapter health, error rate tracking, pipeline stage metrics. |

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    SOURCE ADAPTERS (Plugin-Based)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ LinkedIn │ │ Twitter  │ │  Reddit  │ │  Google  │ │  CSV /    │  │
│  │ Adapter  │ │ Adapter  │ │ Adapter  │ │  Maps    │ │  Webhook  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       └──────┬─────┴──────┬─────┴──────┬─────┴──────┬───────┘        │
└──────────────┼───────────────────────────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              PIPELINE ORCHESTRATOR (BullMQ Event-Driven)              │
│                                                                       │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐   │
│  │   Intent   │──▶│    ICP     │──▶│   Lead     │──▶│  Personal- │   │
│  │  Detector  │   │  Enricher  │   │  Scorer    │   │   izer     │   │
│  │  (AI)      │   │  (AI)      │   │  (Rules)   │   │  (AI)      │   │
│  └────────────┘   └────────────┘   └────────────┘   └────────────┘   │
│        │                                                   │          │
│        │               ┌────────────┐   ┌────────────┐     │          │
│        │               │  Convo     │◀──│  Outreach  │◀────┘          │
│        │               │ Assistant  │   │ Generator  │                │
│        │               │  (AI)      │   │  (AI)      │                │
│        │               └─────┬──────┘   └────────────┘                │
│        │                     │                                        │
│        │               ┌─────▼──────┐   ┌────────────┐                │
│        └──────────────▶│  Feedback  │──▶│    ICP     │                │
│                        │   Loop     │   │  Refiner   │                │
│                        └────────────┘   └────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
               │                                          ▲
               ▼                                          │
┌──────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                   │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │   Supabase    │  │   Upstash    │  │      BullMQ Queues       │   │
│  │  (PostgreSQL  │  │   Redis      │  │  (intent, enrich, score, │   │
│  │  + pgvector   │  │  (cache +    │  │   personalize, outreach) │   │
│  │  + RLS)       │  │   rate-limit)│  │                          │   │
│  └───────────────┘  └──────────────┘  └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Tenancy Model

```typescript
// Environment-driven tenancy mode
// .env: TENANT_MODE=single | multi

// Single-tenant: organizationId = 'default' (constant)
// Multi-tenant: organizationId = UUID from auth context

interface TenantContext {
  organizationId: string;    // 'default' in single-tenant mode
  userId: string;            // Always present
  mode: 'single' | 'multi';
}
```

**How it works:**
- Every DB model has `organizationId` (non-nullable, defaults to `'default'`)
- In single-tenant mode, a `TenantGuard` middleware auto-injects `organizationId = 'default'`
- In multi-tenant mode, `TenantGuard` extracts `organizationId` from JWT/session
- Supabase RLS policies enforce isolation at the database level in multi-tenant mode
- All services receive `TenantContext` via NestJS dependency injection
- **Single-tenant customers deploy the same codebase** — only the env var changes

---

## 6. Project Structure (NestJS + TypeScript)

```
Lead Generation/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── .env.example                          # All configurable env vars documented
├── .env
├── .eslintrc.js
├── .prettierrc
│
├── prisma/
│   ├── schema.prisma                     # Full DB schema with organizationId on every model
│   └── seed.ts                           # Seed data for development
│
├── src/
│   ├── main.ts                           # NestJS bootstrap + global pipes/filters
│   ├── app.module.ts                     # Root module — imports all feature modules
│   │
│   ├── common/                           # 🔧 SHARED — used across all modules
│   │   ├── interfaces/
│   │   │   ├── tenant-context.interface.ts      # TenantContext shape
│   │   │   ├── adapter.interface.ts             # ISourceAdapter contract
│   │   │   ├── ai-provider.interface.ts         # IAIProvider contract
│   │   │   ├── pipeline-stage.interface.ts      # IPipelineStage contract
│   │   │   ├── lead-input.interface.ts          # Normalized lead input
│   │   │   └── scoring-factor.interface.ts      # IScoringFactor shape
│   │   ├── types/
│   │   │   ├── intent.types.ts                  # IntentResult, UrgencyLevel, etc.
│   │   │   ├── icp.types.ts                     # ICPAttributes, PainPoint, etc.
│   │   │   ├── scoring.types.ts                 # ScoreBreakdown, Tier, etc.
│   │   │   ├── personalization.types.ts         # PersonalizationLayers, Tone, etc.
│   │   │   ├── message.types.ts                 # MessageChannel, MessageStatus
│   │   │   └── lead.types.ts                    # LeadStatus, LeadSource, etc.
│   │   ├── enums/
│   │   │   ├── lead-status.enum.ts
│   │   │   ├── lead-tier.enum.ts
│   │   │   ├── lead-source.enum.ts
│   │   │   ├── message-status.enum.ts
│   │   │   ├── urgency-level.enum.ts
│   │   │   └── tenant-mode.enum.ts
│   │   ├── decorators/
│   │   │   ├── tenant.decorator.ts              # @CurrentTenant() param decorator
│   │   │   └── roles.decorator.ts
│   │   ├── guards/
│   │   │   ├── tenant.guard.ts                  # Injects organizationId per request
│   │   │   ├── auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts           # Structured logs with correlation IDs
│   │   │   └── usage-tracking.interceptor.ts    # Per-org AI/API usage metering
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── dto/                                 # Shared Data Transfer Objects
│   │   │   ├── pagination.dto.ts
│   │   │   └── api-response.dto.ts
│   │   ├── constants/
│   │   │   ├── defaults.ts                      # Default org ID, thresholds
│   │   │   └── queue-names.ts                   # BullMQ queue name constants
│   │   └── utils/
│   │       ├── logger.util.ts
│   │       ├── rate-limiter.util.ts
│   │       ├── deduplicator.util.ts
│   │       └── hash.util.ts
│   │
│   ├── config/                           # ⚙️ CONFIGURATION MODULE
│   │   ├── config.module.ts
│   │   ├── config.service.ts                    # Typed env access
│   │   ├── ai.config.ts                         # AI model selection per task
│   │   ├── scoring.config.ts                    # Lead scoring weights (tunable)
│   │   ├── scraping.config.ts                   # Rate limits, delays, proxy settings
│   │   └── tenancy.config.ts                    # Single vs multi-tenant settings
│   │
│   ├── database/                         # 💾 DATABASE MODULE
│   │   ├── database.module.ts
│   │   ├── prisma.service.ts                    # Prisma client (extends OnModuleInit)
│   │   ├── redis.service.ts                     # Upstash Redis client
│   │   └── supabase.service.ts                  # Supabase client (for auth + RLS)
│   │
│   ├── auth/                             # 🔐 AUTH MODULE
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts                      # Supabase Auth integration
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── api-key.strategy.ts              # For webhook/API access
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── register.dto.ts
│   │
│   ├── organizations/                    # 🏢 ORGANIZATION MODULE (multi-tenant)
│   │   ├── organizations.module.ts
│   │   ├── organizations.controller.ts
│   │   ├── organizations.service.ts
│   │   └── dto/
│   │       ├── create-organization.dto.ts
│   │       └── update-organization.dto.ts
│   │
│   ├── adapters/                         # 🔌 SOURCE ADAPTERS MODULE
│   │   ├── adapters.module.ts
│   │   ├── adapter-registry.service.ts          # Registry pattern — discover + instantiate adapters
│   │   ├── base.adapter.ts                      # Abstract base with common logic
│   │   ├── linkedin/
│   │   │   ├── linkedin.adapter.ts              # Playwright-based scraper
│   │   │   ├── linkedin-stealth.service.ts      # Anti-detection: fingerprinting, delays
│   │   │   ├── linkedin-session.service.ts      # Cookie/session management
│   │   │   └── linkedin.config.ts               # Proxy list, rate limits
│   │   ├── google-maps/
│   │   │   ├── google-maps.adapter.ts           # Google Places API adapter
│   │   │   ├── google-maps.service.ts           # Business search by industry + location
│   │   │   └── google-maps.config.ts
│   │   ├── twitter/
│   │   │   ├── twitter.adapter.ts               # Twitter API v2
│   │   │   └── twitter.config.ts
│   │   ├── reddit/
│   │   │   ├── reddit.adapter.ts                # Reddit API
│   │   │   └── reddit.config.ts
│   │   ├── csv/
│   │   │   └── csv.adapter.ts                   # Bulk CSV import
│   │   └── webhook/
│   │       └── webhook.adapter.ts               # POST /api/leads/ingest
│   │
│   ├── ai/                               # 🧠 AI PROVIDERS MODULE
│   │   ├── ai.module.ts
│   │   ├── ai-provider.factory.ts               # Factory: returns OpenAI or Claude based on config
│   │   ├── providers/
│   │   │   ├── openai.provider.ts               # OpenAI API implementation
│   │   │   └── claude.provider.ts               # Anthropic API implementation
│   │   ├── prompts/                             # Versioned prompt templates
│   │   │   ├── intent-detection.prompt.ts       # Buyer classification prompt
│   │   │   ├── icp-extraction.prompt.ts         # Role/stage/budget extraction
│   │   │   ├── personalization.prompt.ts        # 4-layer personalization
│   │   │   ├── outreach.prompt.ts               # Message generation
│   │   │   ├── conversation.prompt.ts           # Reply suggestions
│   │   │   └── anti-pattern.prompt.ts           # Spam pattern detection
│   │   └── prompt-manager.service.ts            # Version tracking, A/B testing, per-org overrides
│   │
│   ├── pipeline/                         # ⚙️ PIPELINE MODULE (core engine)
│   │   ├── pipeline.module.ts
│   │   ├── orchestrator.service.ts              # BullMQ flow orchestration
│   │   ├── stages/
│   │   │   ├── intent-detector.stage.ts         # Stage 1: AI intent classification
│   │   │   ├── icp-enricher.stage.ts            # Stage 2: AI profile enrichment
│   │   │   ├── lead-scorer.stage.ts             # Stage 3: Deterministic scoring
│   │   │   ├── personalizer.stage.ts            # Stage 4: 4-layer personalization
│   │   │   ├── outreach-generator.stage.ts      # Stage 5: Message generation
│   │   │   ├── conversation-assistant.stage.ts  # Stage 6: Reply handling
│   │   │   └── icp-refiner.stage.ts             # Stage 7: Feedback-driven ICP update
│   │   └── processors/                          # BullMQ job processors
│   │       ├── intent.processor.ts
│   │       ├── enrichment.processor.ts
│   │       ├── scoring.processor.ts
│   │       ├── personalization.processor.ts
│   │       └── outreach.processor.ts
│   │
│   ├── scoring/                          # 📊 SCORING MODULE (deterministic)
│   │   ├── scoring.module.ts
│   │   ├── scoring-engine.service.ts            # Core score calculator
│   │   ├── factors/                             # Individual scoring factors
│   │   │   ├── intent-factor.ts                 # Hiring intent keywords
│   │   │   ├── urgency-factor.ts                # Urgency signal weight
│   │   │   ├── role-factor.ts                   # Founder/CTO/VP weight
│   │   │   ├── budget-factor.ts                 # Budget signal weight
│   │   │   ├── recency-factor.ts                # How recent the activity is
│   │   │   ├── icp-fit-factor.ts                # Google Maps: industry/location match
│   │   │   └── negative-factors.ts              # Competitor, already-hired penalties
│   │   └── thresholds.ts                        # HOT (20+), WARM (10-19), COLD (0-9)
│   │
│   ├── leads/                            # 📋 LEADS MODULE (CRUD + business logic)
│   │   ├── leads.module.ts
│   │   ├── leads.controller.ts
│   │   ├── leads.service.ts
│   │   ├── deduplication.service.ts             # Prevent duplicate leads across sources
│   │   └── dto/
│   │       ├── create-lead.dto.ts
│   │       ├── update-lead.dto.ts
│   │       └── lead-filter.dto.ts
│   │
│   ├── messages/                         # ✉️ MESSAGES MODULE
│   │   ├── messages.module.ts
│   │   ├── messages.controller.ts
│   │   ├── messages.service.ts
│   │   ├── anti-spam.service.ts                 # Pattern matching + uniqueness check
│   │   └── dto/
│   │       ├── create-message.dto.ts
│   │       └── approve-message.dto.ts
│   │
│   ├── conversations/                    # 💬 CONVERSATIONS MODULE
│   │   ├── conversations.module.ts
│   │   ├── conversations.controller.ts
│   │   ├── conversations.service.ts
│   │   └── objection-handler.service.ts         # Pricing, timing, trust objections
│   │
│   ├── campaigns/                        # 🎯 CAMPAIGNS MODULE
│   │   ├── campaigns.module.ts
│   │   ├── campaigns.controller.ts
│   │   ├── campaigns.service.ts
│   │   └── dto/
│   │       ├── create-campaign.dto.ts
│   │       └── campaign-filter.dto.ts
│   │
│   ├── icp/                              # 🧠 ICP MODULE
│   │   ├── icp.module.ts
│   │   ├── icp.controller.ts
│   │   ├── icp.service.ts
│   │   └── icp-learning.service.ts              # Feedback-driven weight adjustment
│   │
│   ├── analytics/                        # 📊 ANALYTICS MODULE
│   │   ├── analytics.module.ts
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   ├── usage-metering.service.ts            # Per-org AI token + API usage tracking
│   │   └── events/
│   │       └── analytics-event.service.ts       # Event emitter for pipeline tracking
│   │
│   ├── compliance/                       # 🛡️ COMPLIANCE MODULE (GDPR)
│   │   ├── compliance.module.ts
│   │   ├── compliance.controller.ts             # Opt-out, data deletion, export
│   │   ├── compliance.service.ts
│   │   └── data-retention.service.ts            # Auto-delete expired data
│   │
│   ├── health/                           # 🏥 HEALTH MODULE
│   │   ├── health.module.ts
│   │   ├── health.controller.ts                 # GET /health — overall system health
│   │   └── indicators/
│   │       ├── database.health.ts               # Supabase connectivity
│   │       ├── redis.health.ts                  # Upstash connectivity
│   │       ├── queue.health.ts                  # BullMQ queue depth
│   │       └── adapter.health.ts                # Per-adapter success rate
│   │
│   └── jobs/                             # ⏰ SCHEDULED JOBS MODULE
│       ├── jobs.module.ts
│       ├── daily-scrape.job.ts                  # Cron: run all active adapters
│       ├── data-retention.job.ts                # Cron: purge expired data
│       ├── analytics-rollup.job.ts              # Cron: aggregate daily metrics
│       └── icp-refinement.job.ts                # Cron: weekly ICP weight adjustment
│
├── test/                                 # 🧪 TESTS
│   ├── unit/
│   │   ├── scoring-engine.spec.ts
│   │   ├── intent-detector.spec.ts
│   │   ├── personalizer.spec.ts
│   │   ├── lead-scorer.spec.ts
│   │   ├── deduplication.spec.ts
│   │   └── tenant-guard.spec.ts
│   ├── integration/
│   │   ├── pipeline.spec.ts                     # Full pipeline with mock AI
│   │   ├── linkedin-adapter.spec.ts
│   │   └── google-maps-adapter.spec.ts
│   ├── e2e/
│   │   ├── leads.e2e-spec.ts
│   │   ├── campaigns.e2e-spec.ts
│   │   └── compliance.e2e-spec.ts
│   └── fixtures/
│       ├── sample-linkedin-posts.json
│       ├── sample-google-maps-businesses.json
│       └── sample-leads.json
│
├── docs/                                 # 📖 DOCUMENTATION
│   ├── ARCHITECTURE.md                          # System architecture + data flow diagrams
│   ├── EXTENDING.md                             # How to add new adapters, AI providers, scoring factors
│   ├── PRIVACY.md                               # GDPR compliance documentation
│   ├── API.md                                   # REST API reference
│   ├── DEPLOYMENT.md                            # Railway + Vercel deployment guide
│   ├── CONFIGURATION.md                         # All env vars documented
│   └── TENANCY.md                               # Single vs multi-tenant setup guide
│
└── dashboard/                            # 🖥️ DASHBOARD (Phase 4 — Next.js)
    └── (created later with npx create-next-app)
```

---

## 7. Database Schema (Prisma)

### 7.1 Tenancy Strategy

Every model includes `organizationId`:
- **Multi-tenant mode:** Populated from JWT, enforced via Supabase RLS
- **Single-tenant mode:** Auto-set to `'default'` by `TenantGuard`, RLS disabled

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")          // Supabase connection pooling
  extensions = [pgvector(map: "vector")]
}

// ─────────────────────────────────────────────
// ORGANIZATION (multi-tenant root)
// ─────────────────────────────────────────────
model Organization {
  id              String    @id @default(uuid())
  name            String
  slug            String    @unique
  
  // Subscription / limits
  tier            String    @default("free")     // free, pro, enterprise
  maxLeadsPerDay  Int       @default(50)
  maxAiTokensPerMonth BigInt @default(1000000)
  
  // AI Configuration (per-org)
  classificationModel  String  @default("gpt-4o-mini")  // or "claude-haiku"
  personalizationModel String  @default("gpt-4o")       // or "claude-sonnet"
  
  // Positioning prompts (configurable per org from dashboard)
  serviceOffering     String?   // "We build MVPs for startups"
  uniqueValue         String?   // "Launch in 4 weeks, not 4 months"
  positioningPrompt   String?   // Full custom positioning prompt override
  
  users           User[]
  leads           Lead[]
  campaigns       Campaign[]
  icpProfiles     ICPProfile[]
  messages        Message[]
  conversations   Conversation[]
  analyticsEvents AnalyticsEvent[]
  usageRecords    UsageRecord[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  name            String?
  role            String    @default("member")   // owner, admin, member
  supabaseUserId  String    @unique              // Link to Supabase Auth
  
  organization    Organization @relation(fields: [organizationId], references: [id])
  organizationId  String
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([organizationId])
}

// ─────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────
model Lead {
  id              String    @id @default(uuid())
  organization    Organization @relation(fields: [organizationId], references: [id])
  organizationId  String
  
  // Source
  externalId      String?                  // Platform-specific ID
  source          String                   // "linkedin", "twitter", "reddit", "google_maps", "csv", "webhook"
  sourceUrl       String?
  sourceType      String    @default("intent")  // "intent" (social) or "discovery" (google maps)
  
  // Profile
  name            String
  headline        String?
  bio             String?
  role            String?                  // "Founder", "CTO", etc.
  company         String?
  companySize     String?
  industry        String?
  location        String?
  email           String?
  phone           String?
  website         String?
  
  // Intent (populated for intent-based leads)
  originalContent String?                  // The post/comment that triggered detection
  intentType      String?                  // "MVP Development", "Hiring", etc.
  intentUrgency   String?                  // "high", "medium", "low"
  intentConfidence Float?                  // 0.0 - 1.0
  isBuyer         Boolean   @default(false)
  intentReasoning String?                  // AI's explanation for debugging
  
  // Google Maps specific (populated for discovery leads)
  placeId         String?                  // Google Place ID
  rating          Float?
  reviewCount     Int?
  businessType    String?
  
  // ICP Enrichment
  companyStage    String?                  // "Pre-seed", "Seed", "Series A", etc.
  technicalLevel  String?                  // "Non-technical", "Semi-technical", "Technical"
  budgetSignal    String?                  // "high", "medium", "low"
  hiringIntent    Boolean   @default(false)
  painPoints      Json?                    // string[]
  fears           Json?                    // string[]
  desires         Json?                    // string[]
  
  // Scoring (deterministic)
  score           Int       @default(0)
  scoreBreakdown  Json?                    // { factorName: points }
  tier            String    @default("COLD")  // "HOT", "WARM", "COLD"
  
  // Personalization layers
  personalContext Json?                    // Layer 1: Context from their content
  psychology      Json?                    // Layer 2: Fears, desires, personality
  positioning     Json?                    // Layer 3: Offer → Problem match
  toneProfile     String?                  // "formal", "casual", "direct", "friendly"
  
  // Pipeline state
  status          String    @default("NEW")
  // NEW → QUALIFIED → MESSAGED → REPLIED → MEETING → CLOSED_WON → CLOSED_LOST
  
  // Recommended outreach channel
  recommendedChannel String?              // "linkedin_dm", "linkedin_comment", "twitter_dm", "email"
  
  // Relationships
  messages        Message[]
  conversations   Conversation[]
  campaign        Campaign?  @relation(fields: [campaignId], references: [id])
  campaignId      String?
  
  // Compliance (GDPR)
  consentBasis    String    @default("LEGITIMATE_INTEREST")
  optedOut        Boolean   @default(false)
  dataExpiresAt   DateTime                // Auto-delete date (createdAt + 90 days)
  
  // Dedup
  contentHash     String?                  // Hash of originalContent for dedup
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@unique([externalId, source, organizationId])
  @@index([organizationId, tier, status])
  @@index([organizationId, score])
  @@index([organizationId, source])
  @@index([contentHash, organizationId])
}

// ─────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────
model Message {
  id              String    @id @default(uuid())
  organization    Organization @relation(fields: [organizationId], references: [id])
  organizationId  String
  lead            Lead      @relation(fields: [leadId], references: [id])
  leadId          String
  
  type            String                   // "INITIAL", "FOLLOWUP", "REPLY_SUGGESTION"
  channel         String                   // "linkedin_dm", "linkedin_comment", "twitter_dm", "email"
  content         String
  personalContext Json?                    // Why this message was crafted this way
  
  status          String    @default("DRAFT")
  // DRAFT → APPROVED → SENT → DELIVERED → REPLIED → CONVERTED
  approvedBy      String?
  sentAt          DateTime?
  repliedAt       DateTime?
  
  // Quality checks
  spamScore       Float?                   // 0.0 = clean, 1.0 = spammy
  uniquenessScore Float?                   // Similarity to recent messages (lower = more unique)
  
  // Traceability
  promptVersion   String?                  // Which prompt template version generated this
  aiModel         String?                  // Which AI model generated this
  aiTokensUsed    Int?                     // Token consumption for cost tracking
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([organizationId, status])
  @@index([leadId])
}

// ─────────────────────────────────────────────
// CONVERSATIONS
// ─────────────────────────────────────────────
model Conversation {
  id              String    @id @default(uuid())
  organization    Organization @relation(fields: [organizationId], references: [id])
  organizationId  String
  lead            Lead      @relation(fields: [leadId], references: [id])
  leadId          String
  
  messages        Json                     // Array of { role, content, timestamp }
  suggestedReply  String?
  objectionType   String?                  // "pricing", "timing", "trust", "scope", "competitor"
  sentiment       String?                  // "positive", "neutral", "objection", "rejection"
  closingStrategy String?                  // Recommended closing approach
  
  status          String    @default("ACTIVE")  // ACTIVE, STALE, CONVERTED, LOST
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([organizationId, status])
  @@index([leadId])
}

// ─────────────────────────────────────────────
// CAMPAIGNS
// ─────────────────────────────────────────────
model Campaign {
  id              String    @id @default(uuid())
  organization    Organization @relation(fields: [organizationId], references: [id])
  organizationId  String
  name            String
  description     String?
  
  // ICP Configuration for this campaign
  icpConfig       Json                     // Target ICP attributes
  keywords        Json                     // Search keywords per source
  sources         Json                     // Active adapters: ["linkedin", "google_maps"]
  targetLocations Json?                    // For Google Maps: ["New York", "London"]
  targetIndustries Json?                   // For Google Maps: ["restaurants", "real estate"]
  
  // Custom scoring overrides (optional per-campaign tuning)
  scoringWeights  Json?
  
  // Custom positioning for this campaign
  positioningPrompt String?                // Override org-level positioning
  
  // Stats (denormalized for performance)
  leadsGenerated  Int       @default(0)
  messagesSent    Int       @default(0)
  replies         Int       @default(0)
  meetings        Int       @default(0)
  conversions     Int       @default(0)
  
  leads           Lead[]
  
  status          String    @default("ACTIVE")   // ACTIVE, PAUSED, COMPLETED
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([organizationId, status])
}

// ─────────────────────────────────────────────
// ICP PROFILES (adaptive, learning)
// ─────────────────────────────────────────────
model ICPProfile {
  id              String    @id @default(uuid())
  organization    Organization @relation(fields: [organizationId], references: [id])
  organizationId  String
  name            String
  version         Int       @default(1)
  
  // Base criteria
  targetRoles     Json                     // ["Founder", "CEO", "CTO"]
  targetIndustries Json                    // ["SaaS", "E-commerce", "FinTech"]
  targetStages    Json                     // ["Pre-seed", "Seed", "Series A"]
  targetLocations Json?                    // Geographic targeting
  
  // Behavioral signals
  buyerSignals    Json                     // Keywords and patterns
  urgencySignals  Json                     // Urgency keywords
  budgetSignals   Json                     // Budget indicator patterns
  
  // Learned weights (updated by feedback loop)
  learnedWeights  Json?                    // Auto-adjusted from conversion data
  conversionRate  Float?                   // Historical conversion rate for this ICP
  
  isActive        Boolean   @default(true)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([organizationId, isActive])
}

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────
model AnalyticsEvent {
  id              String    @id @default(uuid())
  organization    Organization @relation(fields: [organizationId], references: [id])
  organizationId  String
  
  eventType       String                   // "lead_created", "intent_detected", "message_sent", "reply_received", "meeting_booked", "deal_closed"
  entityType      String                   // "lead", "message", "campaign", "conversation"
  entityId        String
  metadata        Json?                    // Event-specific data
  
  createdAt       DateTime  @default(now())
  
  @@index([organizationId, eventType, createdAt])
  @@index([entityType, entityId])
}

// Per-organization usage metering (cost tracking)
model UsageRecord {
  id              String    @id @default(uuid())
  organization    Organization @relation(fields: [organizationId], references: [id])
  organizationId  String
  
  date            DateTime  @db.Date              // Day granularity
  aiTokensUsed    BigInt    @default(0)            // Total AI tokens
  aiCostCents     Int       @default(0)            // Estimated cost in cents
  scrapesExecuted Int       @default(0)            // Number of scrape operations
  leadsProcessed  Int       @default(0)            // Leads through pipeline
  apiCallsMade    Int       @default(0)            // External API calls (Google Maps, etc.)
  
  @@unique([organizationId, date])
  @@index([organizationId, date])
}
```

---

## 8. Dual Scoring Tracks

### 8.1 Intent-Based Scoring (LinkedIn, Twitter, Reddit)

| Factor | Points | Source |
|--------|--------|--------|
| Explicit hiring intent keyword | +10 | Intent Detector |
| Urgency = High | +5 | Intent Detector |
| Urgency = Medium | +3 | Intent Detector |
| Role = Founder/CEO | +5 | ICP Enricher |
| Role = CTO/VP Eng | +3 | ICP Enricher |
| Company stage = Pre-seed/Seed | +3 | ICP Enricher |
| Budget signal = High | +4 | ICP Enricher |
| Budget signal = Medium | +2 | ICP Enricher |
| Recent activity (< 24hrs) | +3 | Adapter |
| Recent activity (< 48hrs) | +1 | Adapter |
| Non-technical founder | +2 | ICP Enricher |
| Multiple pain points (3+) | +2 | ICP Enricher |
| Returning lead | +3 | Dedup Service |
| **Negative: Competitor** | **-10** | ICP Enricher |
| **Negative: Already hired** | **-15** | Intent Detector |

### 8.2 Discovery-Based Scoring (Google Maps)

| Factor | Points | Source |
|--------|--------|--------|
| Industry matches target ICP | +8 | Google Maps Adapter |
| Location matches target | +5 | Google Maps Adapter |
| Has website (online presence) | +3 | Google Maps Adapter |
| No website (needs help) | +5 | Google Maps Adapter |
| Low Google rating (< 3.5) | +3 | Google Maps Adapter |
| High review count (established) | +2 | Google Maps Adapter |
| Recently opened (< 1 year) | +4 | Google Maps Adapter |
| Has email listed | +2 | Google Maps Adapter |
| **Negative: Chain/franchise** | **-8** | Google Maps Adapter |

**Tiers (same for both):** HOT (20+), WARM (10-19), COLD (0-9)

---

## 9. Anti-Detection Strategy (LinkedIn)

```typescript
// linkedin-stealth.service.ts — Key strategies:

// 1. Random delays (Gaussian distribution, not uniform)
//    Mean: 3s, StdDev: 1.5s, Min: 1s, Max: 8s

// 2. Browser fingerprint randomization
//    - Random viewport sizes (within common ranges)
//    - Random User-Agent from real browser pool
//    - WebGL noise injection
//    - Canvas fingerprint randomization

// 3. Human-like scrolling patterns
//    - Variable scroll speed
//    - Occasional scroll-up (humans do this)
//    - Pause on elements (reading simulation)

// 4. Session management
//    - Persistent cookies across runs
//    - Rotate between multiple accounts
//    - Warm up new accounts gradually (5 actions/day → 20 → 50)

// 5. Residential proxy rotation
//    - Rotate IP per session, not per request
//    - Stick to same geo region as account

// 6. Activity limits
//    - Max 100 profile views/day per account
//    - Max 50 search results/day per account
//    - Cooldown periods between bursts
```

---

## 10. Configuration System (.env)

```bash
# ─── TENANCY ───
TENANT_MODE=single                    # single | multi

# ─── DATABASE ───
DATABASE_URL=postgresql://...         # Supabase connection string
DIRECT_URL=postgresql://...           # Supabase direct URL (bypasses pooler)

# ─── REDIS ───
UPSTASH_REDIS_URL=redis://...
UPSTASH_REDIS_TOKEN=...

# ─── AI PROVIDERS ───
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Default AI models (overridable per organization)
DEFAULT_CLASSIFICATION_MODEL=gpt-4o-mini    # or claude-haiku
DEFAULT_PERSONALIZATION_MODEL=gpt-4o        # or claude-sonnet

# ─── SCRAPING ───
LINKEDIN_PROXY_LIST=socks5://...      # Comma-separated residential proxies
LINKEDIN_MAX_DAILY_SCRAPES=100
LINKEDIN_MIN_DELAY_MS=1000
LINKEDIN_MAX_DELAY_MS=8000

# ─── GOOGLE MAPS ───
GOOGLE_MAPS_API_KEY=...
GOOGLE_MAPS_MAX_DAILY_REQUESTS=500

# ─── SCORING THRESHOLDS ───
SCORE_HOT_THRESHOLD=20
SCORE_WARM_THRESHOLD=10
INTENT_CONFIDENCE_THRESHOLD=0.80

# ─── COMPLIANCE ───
DATA_RETENTION_DAYS=90

# ─── DEFAULT POSITIONING (single-tenant, overridden in dashboard for multi) ───
DEFAULT_SERVICE_OFFERING="We build lean MVPs for startups"
DEFAULT_UNIQUE_VALUE="Launch in weeks, not months"

# ─── DEPLOYMENT ───
PORT=3000
NODE_ENV=development
```

---

## 11. Phased Execution Plan (Revised)

### Phase 1 — Foundation + Core Pipeline (Week 1-2)
- [ ] NestJS project initialization (TypeScript strict mode)
- [ ] Prisma schema + Supabase setup + migrations
- [ ] Config module (typed env access)
- [ ] Common module (interfaces, types, enums, guards, decorators)
- [ ] Database module (Prisma service + Redis service)
- [ ] Auth module (Supabase Auth + JWT strategy)
- [ ] Organization module (CRUD, tenant guard)
- [ ] Base adapter interface + CSV adapter + webhook adapter
- [ ] BullMQ pipeline orchestrator skeleton
- [ ] Leads module (CRUD + deduplication)
- [ ] Health module (DB + Redis + queue checks)
- [ ] Structured logging with correlation IDs
- [ ] **Unit tests for tenant guard, dedup, and scoring**

### Phase 2 — AI Pipeline + Scoring (Week 2-3)
- [ ] AI module (provider factory, OpenAI + Claude implementations)
- [ ] Prompt templates (all 6 prompt files, versioned)
- [ ] Prompt manager (version tracking, per-org overrides)
- [ ] Intent detection stage + processor
- [ ] ICP enrichment stage + processor
- [ ] Deterministic scoring engine (all factors)
- [ ] 4-layer personalizer stage
- [ ] Outreach generator stage
- [ ] Anti-spam service (pattern matching + uniqueness)
- [ ] Messages module (CRUD + approval flow)
- [ ] Usage metering interceptor
- [ ] **Integration tests: full pipeline with mock AI**
- [ ] **🔴 CHECKPOINT: Validate pipeline with 10 sample posts manually**

### Phase 3 — Adapters + Advanced Features (Week 3-4)
- [ ] LinkedIn adapter (Playwright + stealth service)
- [ ] LinkedIn session management + proxy rotation
- [ ] Google Maps adapter (Places API)
- [ ] Dual scoring tracks (intent vs discovery)
- [ ] Conversation assistant stage
- [ ] Objection handler service
- [ ] Campaign module (CRUD + per-campaign config)
- [ ] ICP module (CRUD + learning service)
- [ ] Scheduled jobs (daily scrape, data retention, ICP refinement)
- [ ] Compliance module (opt-out, deletion, export)
- [ ] Analytics module (event tracking + rollups)
- [ ] **🔴 CHECKPOINT: End-to-end test with real LinkedIn scrape**
- [ ] **Validate anti-detection, human simulation, blocker bypass**

### Phase 4 — Dashboard + Polish (Week 4-5)
- [ ] Next.js dashboard project setup
- [ ] Lead board (kanban: NEW → QUALIFIED → MESSAGED → REPLIED → MEETING → CLOSED)
- [ ] Message approval queue
- [ ] Campaign management UI
- [ ] ICP configuration UI
- [ ] Positioning prompt editor (per-org)
- [ ] Analytics dashboard (reply rate, conversion rate, cost per lead)
- [ ] Settings panel (AI model selection, scoring weights)
- [ ] Feedback loop visualization
- [ ] **Full e2e testing**

---

## 12. Verification Plan

### Automated Testing
```bash
npm run test              # All unit tests
npm run test:integration  # Pipeline with mock AI
npm run test:e2e          # API endpoint tests
npm run test:cov          # Coverage report
```

Each module is independently testable via NestJS `Test.createTestingModule()`.

### Manual Verification Checkpoints
1. **After Phase 1:** Verify tenant guard works in both modes, leads CRUD works, health endpoint returns green
2. **After Phase 2:** Feed 10 sample LinkedIn posts → verify intent detection accuracy, scoring consistency, message quality. **Do NOT proceed until satisfied with AI output quality.**
3. **After Phase 3:** Run live LinkedIn scrape → verify stealth works, proxy rotation functions, data flows through full pipeline. Test Google Maps for 3 different industries.
4. **After Phase 4:** Full UI walkthrough — create campaign, scrape leads, review messages, approve/reject, track analytics

---

## 13. Documentation Deliverables

| Doc | Content |
|---|---|
| `ARCHITECTURE.md` | System diagrams, data flow, module dependency graph |
| `EXTENDING.md` | Step-by-step: add new adapter, add new AI provider, add new scoring factor |
| `CONFIGURATION.md` | Every env var documented with type, default, and example |
| `TENANCY.md` | Single vs multi-tenant setup, RLS policies, migration guide |
| `PRIVACY.md` | GDPR compliance, data retention, opt-out flow |
| `API.md` | Full REST API reference with examples |
| `DEPLOYMENT.md` | Railway + Vercel deployment guide |

**In-code comments:** Every pipeline stage, scoring factor, and adapter will have JSDoc comments explaining the data flow, inputs, outputs, and rationale for key decisions.
