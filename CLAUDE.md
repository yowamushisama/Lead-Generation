# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An **AI Intent-Based Client Acquisition Engine** built with NestJS. It discovers high-intent buyers across LinkedIn, Google Maps, and CSV imports; scores them with a deterministic 7-factor engine; generates personalized outreach via Claude/OpenAI; and feeds conversion data back to refine targeting. Supports both multi-tenant SaaS and single-tenant self-hosted deployment.

## Commands

```bash
# Development
npm run start:dev          # Watch mode, hot reload
npm run start:debug        # With Node debugger

# Build & Production
npm run build              # Compile TypeScript → dist/
npm run start:prod         # Run dist/main.js

# Testing
npm test                   # All unit tests
npm run test:watch         # Watch mode
npm run test:cov           # With coverage report
npm test -- path/to/file.spec.ts  # Single test file

# Code quality
npm run lint               # ESLint with auto-fix
npm run format             # Prettier format

# Database
npm run prisma:generate    # Regenerate Prisma client after schema changes
npm run prisma:migrate     # Run migrations (dev)
npm run prisma:push        # Push schema without migration (prototype)
npm run prisma:studio      # Visual DB browser at localhost:5555

# LinkedIn adapter diagnostics
npm run linkedin:test-live # Build + run test-linkedin-adapter.ts
npm run linkedin:dump-dom  # Build + dump LinkedIn DOM for selector updates
```

## Architecture

### Request Flow

```
HTTP Request → Auth (JWT/API Key) → TenantGuard → Controller → Service → Prisma/Redis
```

### Pipeline Flow (async, BullMQ)

```
Adapter (CSV/LinkedIn/Google Maps/Webhook)
  → intent queue     → IntentProcessor     (AI intent extraction)
  → enrich queue     → EnrichmentProcessor (profile enrichment)
  → score queue      → ScoringProcessor    (deterministic scoring)
  → personalize queue → PersonalizationProcessor
  → outreach queue   → OutreachProcessor   (message generation)
```

Entry point: `src/main.ts`. API prefix `/api`, versioned `/api/v1/...`. Swagger at `/api/docs` (non-production only).

### Key Modules

| Module | Path | Role |
|--------|------|------|
| Pipeline | `src/pipeline/` | BullMQ orchestrator + 7 stage/processor pairs |
| Scoring | `src/scoring/` | Deterministic scoring engine with 7 weighted factors |
| AI | `src/ai/` | `AIProviderFactory` for Claude/OpenAI, prompt templates |
| Adapters | `src/adapters/` | CSV, Webhook, LinkedIn (Playwright stealth), Google Maps |
| Database | `src/database/` | Prisma ORM, Redis (ioredis), Supabase client |
| Common | `src/common/` | `TenantGuard`, `LoggingInterceptor`, `GlobalExceptionFilter`, shared DTOs/enums |
| Auth | `src/auth/` | JWT + API key strategies via Passport |
| Jobs | `src/jobs/` | Cron jobs: daily scrape, data retention cleanup, ICP refinement |

### Multi-Tenancy

`TenantGuard` (`src/common/guards/`) enforces org isolation. All data-access queries must filter by `organizationId`. `TENANT_MODE=multi` (SaaS) vs `TENANT_MODE=single` (self-hosted) is set via env.

### Database Schema

`prisma/schema.prisma` — 48 models. Central entity is `Organization` which owns all leads, campaigns, ICP profiles, messages, conversations, usage records, and analytics. Uses pgvector extension for embedding-based similarity search.

### Scoring Engine

`src/scoring/scoring-engine.service.ts` — 7 weighted factors: intent strength, role fit, urgency signals, recency, budget indicators, ICP fit, negative signals. Thresholds in `src/scoring/thresholds.ts`. Factors are in `src/scoring/factors/`.

### AI Provider Factory

`src/ai/` — `AIProviderFactory` returns either OpenAI (`gpt-4o`) or Claude (`claude-opus-4-6`) based on config. Prompt templates live alongside the provider implementations.

## Configuration

Copy `.env.example` → `.env` (or `.env.local`). Key variables:

- `TENANT_MODE` — `multi` or `single`
- `DATABASE_URL` — Supabase PostgreSQL connection string (requires pgvector)
- `REDIS_URL` — Upstash Redis URL
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — AI providers
- `AI_PROVIDER` — `openai` or `anthropic`
- `LINKEDIN_EMAIL` / `LINKEDIN_PASSWORD` — For LinkedIn adapter (Playwright)

## Testing

Tests use `ts-jest`. Unit test specs live both in `test/unit/` and inline next to source (`*.spec.ts`). Test fixtures are in `test/fixtures/`. The `moduleNameMapper` resolves `src/*` path aliases in tests.

## Implementation Status

See `PROGRESS.md` for full status. Summary:
- **Phase 1** (Foundation): Complete
- **Phase 2** (AI Pipeline + Scoring): ~95% complete
- **Phase 3** (Adapters + Advanced Features): ~70% complete — LinkedIn/Google Maps adapters partially done
- **Phase 4** (Dashboard): Not started
