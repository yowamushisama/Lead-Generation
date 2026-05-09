# Manual Campaign Pipeline Trigger — Plan

## Context

Today the campaign pipeline only runs in two situations:

1. **On status change** — `PATCH /api/v1/campaigns/:id/launch` and `…/resume` flip a campaign to ACTIVE, and *if* `CAMPAIGN_RUN_ON_ACTIVATE=true` the runner is invoked **once**.
2. **Daily cron** — `DailyScrapeJob` (`src/jobs/daily-scrape.job.ts`) runs every day at 8 AM and runs every ACTIVE campaign for every org.

There is **no way to say "run this campaign right now"** for a campaign that is already ACTIVE. The Launch button on the frontend (`campaign-detail.tsx:140`) is hidden once the campaign is no longer in DRAFT, so the only way to re-trigger collection is to wait for 8 AM cron, pause+resume, or restart the server. The user wants a button on the campaign detail page that fires the full collection pipeline on demand, anytime, against the current ACTIVE campaign.

---

## How the pipeline executes today (the "what & how")

```
Campaign Launch (DRAFT→ACTIVE)  ┐
Daily 8 AM Cron                 ├──► CampaignRunnerService.runCampaign(tenant, id, trigger)
                                │      │
                                │      ├─ resolves enabled adapters (LinkedIn / Google Maps)
                                │      ├─ checks adapter.isHealthy()
                                │      ├─ for each lead from adapter.collect(config):
                                │      │     OrchestratorService.enqueueLead(lead, tenant, {campaignId})
                                │      │       └─ intentQueue.add('classify-intent', payload)  ── Redis
                                │      └─ returns CampaignRunSummary
                                │
                                ▼
                  BullMQ Workers (5 stages, all polling Redis)
                  intent ──► enrich ──► score ──► personalize ──► outreach
                  (each processor calls orchestrator.enqueueForStage to chain)
```

Key files:
- `src/campaigns/campaigns.controller.ts:129-142` — `launch` endpoint.
- `src/campaigns/campaigns.service.ts:214-238` — DRAFT→ACTIVE transition and call to runner.
- `src/campaigns/campaign-runner.service.ts:58-204` — `runCampaign()`, the actual orchestration.
- `src/pipeline/orchestrator.service.ts:36-74` — `enqueueLead()` (adds to BullMQ `intent` queue).
- `src/pipeline/processors/*.processor.ts` — five worker classes, one per stage.
- `src/pipeline/pipeline.module.ts:28-50` — BullMQ wiring (reads `REDIS_URL`, falls back to `REDIS_HOST:REDIS_PORT`).

---

## Are Redis and BullMQ indispensable? Can Supabase replace them?

**Short answer: BullMQ requires Redis. Supabase (Postgres) cannot replace it without rewriting the pipeline.** But you don't need a paid Redis — **run Redis locally for free**, then swap to managed Redis later by changing one env var.

### Why Postgres-as-queue is the wrong substitute *here*

- All five processors are wired with `@Processor(QUEUE_NAMES.X)` decorators from `@nestjs/bullmq`. Replacing them means rewriting every processor as a polling service plus a job table, retry/backoff logic, dead-letter handling, and a distributed-lock scheme — substantial rewrite of working code.
- Polling Postgres is fine at <10 jobs/min but degrades under load and doesn't give you priorities, delayed jobs, exponential backoff, or rate limiting that BullMQ already provides.
- Redis is *also* used outside of queues: LinkedIn session lock (`src/adapters/linkedin/linkedin-session.service.ts`) and the LinkedIn verify-job distributed lock (`src/jobs/linkedin-verify.job.ts`). You can't escape Redis just by replacing the queue.

### The right answer for local-only / pre-scale: **native local Redis (no Docker)**

You're on WSL2 Ubuntu — install Redis directly via apt. Free, no Docker required.

```bash
sudo apt update
sudo apt install -y redis-server
sudo service redis-server start          # WSL has no systemd by default
redis-cli ping                           # → PONG (sanity check)
```

To make Redis start whenever WSL starts, add `sudo service redis-server start` to your shell rc file (e.g., `~/.bashrc`) or to a WSL startup script. Default install binds to `127.0.0.1:6379` with no password — exactly what BullMQ's fallback config expects.

Update `.env`:
```
# REDIS_URL=…upstash…    ← comment this out
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```
The fallback path in `src/pipeline/pipeline.module.ts:38-48` already supports this; no code changes needed.

**Alternatives if apt install isn't an option:**
- **Memurai** (Windows-native Redis, free dev edition) — install on Windows host, set `REDIS_HOST=$(hostname).local` from WSL or use the Windows IP.
- **Pre-built binary:** `wget` the Redis source tarball, `make`, and run `redis-server` directly. No root required if you build into your home dir.
- **Hosted free tier:** Upstash has a free tier (10,000 commands/day, 256MB). Enough for solo local dev — just keep the existing `REDIS_URL` you already have configured. This is the lowest-effort path: no install at all, the project boots as-is.

**Migration to scale:** when you outgrow local, set `REDIS_URL=rediss://…upstash…` and everything keeps working. Zero code change.

### Decision

Keep BullMQ + Redis. Use local Redis now. Migrate to Upstash (or any managed Redis) later by editing one env var. **Supabase remains the database (via Prisma), nothing changes there.**

---

## What was implemented

### Backend — new "manual run" endpoint

`POST /api/v1/campaigns/:id/run` triggers `CampaignRunnerService.runCampaign()` for an ACTIVE campaign on demand. Distinct from `launch` (which is a state transition); this is a re-run.

1. **Extended the trigger union** — `src/campaigns/campaign-runner.service.ts`
   ```ts
   export type CampaignRunTrigger = 'activation' | 'scheduled' | 'manual';
   export interface CampaignRunSummary { ... }  // now exported
   ```

2. **New service method** — `src/campaigns/campaigns.service.ts`
   ```ts
   async runManually(tenant: TenantContext, id: string): Promise<CampaignRunSummary> {
     const campaign = await this.findOne(tenant, id);  // 404 if missing
     if (campaign.status !== 'ACTIVE' || !campaign.isActive) {
       throw new ForbiddenException('Campaign must be ACTIVE to run manually');
     }
     return this.campaignRunner.runCampaign(tenant, id, 'manual');
   }
   ```
   Reuses the existing `campaignRunner.runCampaign()` — no duplication.

3. **Controller endpoint** — `src/campaigns/campaigns.controller.ts`
   ```ts
   @Post(':id/run')
   async runManually(@Tenant() tenant, @Param('id', ParseUUIDPipe) id): Promise<...> {
     const summary = await this.campaignsService.runManually(tenant, id);
     return ApiResponseDto.success(summary, 'Campaign run started');
   }
   ```
   `POST` (not PATCH) because this is an action, not a state change. Returns `CampaignRunSummary` (`adaptersUsed`, `enqueued`, `skippedAdapters[]`).

4. **New DTO** — `src/campaigns/dto/campaign-run-summary.dto.ts`

**Important:** the runner enqueues asynchronously into BullMQ — the HTTP response returns once enqueue is complete (could be 5-30s if the adapter scrapes). Processing happens in workers afterward; leads appear over the following minutes via existing polling on the leads tab.

### Frontend — "Run Now" button

- `frontend/lib/api-urls.ts` — added `campaigns.run(id)` URL.
- `frontend/models/campaign.ts` — added `CampaignRunSummary` interface.
- `frontend/lib/api-client.ts` — added `campaigns.run(id)` call.
- `frontend/app/(dashboard)/campaigns/[id]/campaign-detail.tsx`:
  - **"Run Now" button** (Zap icon, aqua color) — visible when campaign is ACTIVE, sits next to Pause.
  - **Inline result banner** — appears below the header on success: `"Run started — X leads enqueued from linkedin"` with skipped adapter reasons. Dismissible.
  - **Error banner** — rose-colored, shows error message if the run fails. Dismissible.
  - Auto-invalidates `leads`, `messages`, and `campaign-performance` queries on success.

### Configuration / env

No new env vars required. The existing flags apply to manual runs (they go through the same `runCampaign()`):
- `CAMPAIGN_RUN_SOURCES` — restrict which adapters are used.
- `CAMPAIGN_RUN_MAX_RESULTS_PER_ADAPTER` — cap leads per adapter per run.
- `CAMPAIGN_RUN_DEBUG=true` — log every enqueued lead.

---

## Verification (end-to-end)

1. **Start local Redis:** `sudo service redis-server start` then confirm with `redis-cli ping` → `PONG`. (Or, if using Upstash free tier, leave `REDIS_URL` set and skip this step.)
2. **Start backend:** `npm run start:dev`. Confirm boot logs show no Redis connection errors and the five processors register.
3. **Start frontend:** `cd frontend && npm run dev`. Login.
4. **Pre-create:** ensure there is one ACTIVE campaign with a valid ICP profile and `keywords` set, with `targetSources: ["linkedin"]` (or whichever adapter you want).
5. **Click "Run Now"** on the campaign detail page. Expect:
   - Button enters loading state.
   - Within ~5-30s the request resolves and the UI shows the summary (e.g., `enqueued: 5, adaptersUsed: ["linkedin"]`).
   - Backend logs (`CampaignRunnerService`) show "Campaign run started" with `trigger: 'manual'` and "Campaign run completed".
6. **Watch the pipeline drain:** `npm run prisma:studio` → check `Lead` table — new rows appear with `status: NEW` then progress through `INTENT_CLASSIFIED → ENRICHED → SCORED → PERSONALIZED → MESSAGE_DRAFTED` over a few minutes.
7. **Verify queue activity:** `redis-cli` → `KEYS bull:intent:*` should show jobs being added and removed.
8. **Curl direct test:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/campaigns/<id>/run \
     -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json"
   ```
   Should return `200` with the summary payload.
9. **Negative test:** call `POST /run` on a DRAFT campaign → expect `403 Forbidden` with the "must be ACTIVE" message.
