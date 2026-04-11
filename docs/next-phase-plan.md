# Next Phase Plan — Phase 3 Hardening + Phase 4 Dashboard Kickoff

**Status:** Approved  
**Date:** 2026-04-10  
**Preceded by:** `docs/phase-3-completion-plan.md`

---

## Context

`PROGRESS.md` (dated 2026-04-05) was stale. Actual state as of 2026-04-10:

- Phase 3 adapters are **built but not hardened** — LinkedIn + Google Maps adapters exist, dual scoring tracks are wired, but several bugs will cause silent failures in production.
- The Prisma schema already has `rating`, `reviewCount`, `sourceType` on the `Lead` model — but the Prisma client has not been regenerated, so `scoring.processor.ts` works around it with `(lead as any)` casts.
- Phase 4 (Dashboard) has not started.

---

## Part A — Phase 3 Hardening

Complete these before declaring Phase 3 done. Listed in execution order.

### A1 — Regenerate Prisma client

Eliminates `(lead as any)` casts and makes `sourceType`, `rating`, `reviewCount` fully type-safe.

```bash
npm run prisma:generate
```

After regeneration, remove the `(lead as any)` cast in `src/pipeline/processors/scoring.processor.ts:65` and use `lead.sourceType` directly.

---

### A2 — Atomic Redis SET in session service

**File:** `src/adapters/linkedin/linkedin-session.service.ts`

**Problem:** Two separate calls (`redis.set` + `redis.expire`) — a crash between them leaves a key that never expires.

**Fix:**
```ts
// Before
await this.redis.set(sessionKey, JSON.stringify(cookies));
await this.redis.expire(sessionKey, 43200);

// After
await this.redis.set(sessionKey, JSON.stringify(cookies), 'EX', 43200);
```

---

### A3 — Fix 2FA/checkpoint caching broken state

**File:** `src/adapters/linkedin/linkedin-session.service.ts`

**Problem:** If checkpoint is detected after cookies are cached, subsequent restores load a broken session silently (no error, 0 results).

**Fix:**
1. Move `isCheckpoint()` detection **before** the `redis.set` call — throw immediately if a checkpoint is detected, without caching.
2. On session restore failure, call `await this.redis.del(sessionKey)` to invalidate the cache so the next run triggers a fresh login.

---

### A4 — DOM-based rate-limit detection

**File:** `src/adapters/linkedin/linkedin.adapter.ts`  
**File:** `src/adapters/linkedin/linkedin-selectors.config.ts`

**Problem:** `isRateLimited()` only inspects the URL string. LinkedIn soft-blocks (inline CAPTCHA, challenge iframes) don't change the URL.

**Fix:**
1. Add a `captchaDetection` selector group to `linkedin-selectors.config.ts`:
   ```ts
   captchaDetection: [
     '#captcha-challenge',
     '.challenge-dialog',
     'iframe[src*="challenge"]',
     '[data-test-id="challenge"]',
   ],
   ```
2. In `isRateLimited()`, add a secondary DOM check:
   ```ts
   const hasCaptchaDom = await page.$(LINKEDIN_SELECTORS.captchaDetection[0]) !== null;
   return urlBlocked || hasCaptchaDom;
   ```

---

### A5 — Platform-aware stealth + configurable timezone

**File:** `src/adapters/linkedin/linkedin-stealth.service.ts`

**Problem 1:** `--no-sandbox` and `--disable-dev-shm-usage` are Linux-only flags — on Windows they're no-ops but signal automation to fingerprinting services.

**Problem 2:** Timezone is hardcoded to `America/New_York` — a red flag if the residential proxy is in a different region.

**Fix:**
```ts
// Platform-gated args
const linuxArgs = ['--no-sandbox', '--disable-dev-shm-usage'];
const args = process.platform === 'linux' ? linuxArgs : [];

// Configurable timezone
const timezone = process.env.LINKEDIN_TIMEZONE ?? 'America/New_York';
```

---

### A6 — Google Maps: rate limiting + null-safe website

**File:** `src/adapters/google-maps/google-maps.adapter.ts`

**Problem 1:** No delay between `locations × industries` query combinations — the 2s pagination delay only applies between pages of a single query, not between queries.

**Problem 2:** `(place as any).website` — Places API `textSearch` does not include `website` in its basic response. Without a Place Details API call per result, this field is always `undefined`.

**Fix:**
1. Add a 200ms inter-query delay:
   ```ts
   // between query combinations
   await new Promise(r => setTimeout(r, 200));
   ```
2. Safe access with explanatory comment:
   ```ts
   // NOTE: textSearch does not return website; a Place Details call per result
   // is required to populate this field reliably.
   website: (place as any).website ?? undefined,
   ```

---

### A7 — Enforce intent confidence threshold

**File:** `src/pipeline/processors/scoring.processor.ts`

**Problem:** `meetsConfidenceThreshold()` is implemented in the scoring engine but never called in the processor. Intent leads with confidence < 0.5 are personalized unnecessarily, wasting AI tokens.

**Fix:** After scoring, gate personalization for intent leads:
```ts
const belowConfidence = !isDiscovery && (intent.intentConfidence ?? 0) < 0.5;
if (belowConfidence) {
  this.logger.log({ message: `Lead ${leadId} below confidence threshold — skipping personalization` });
  return;
}
```

---

### A8 — Update PROGRESS.md

After A1–A7 are applied and the verification checklist (see below) passes, update `PROGRESS.md`:
- Phase 3 → **COMPLETE**
- Phase 4 → **IN PROGRESS**

---

## Part B — Phase 4: Dashboard

### B1 — Bootstrap Next.js dashboard project

Create `dashboard/` at the repo root as a standalone Next.js 14 (App Router) project.

```bash
npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir
```

Then add a workspace script to root `package.json`:
```json
"scripts": {
  "dev:dashboard": "npm run dev --workspace=dashboard"
}
```

**Tech stack:**
| Package | Purpose |
|---------|---------|
| Next.js 14 App Router | Framework |
| Tailwind CSS | Styling |
| shadcn/ui | Accessible component library |
| TanStack Query v5 | Server-state / API data fetching |
| Recharts | Analytics charts |
| @dnd-kit/core | Drag-and-drop (kanban) |

---

### B2 — API client layer

**File:** `dashboard/lib/api-client.ts`

Typed fetch wrapper reading `NEXT_PUBLIC_API_URL`. Handles JWT from cookies. Exports typed functions per resource:

```ts
export const api = {
  leads: { list, get, updateStatus },
  messages: { list, approve, reject },
  campaigns: { list, get, create },
  analytics: { summary },
};
```

---

### B3 — Authentication flow

**Files:**
- `dashboard/app/(auth)/login/page.tsx` — email/password form
- `dashboard/lib/auth.ts` — JWT logic
- `dashboard/middleware.ts` — route protection

Flow: POST `/api/v1/auth/login` → store JWT in httpOnly cookie → middleware redirects unauthenticated requests to `/login`.

---

### B4 — Lead board (kanban)

**File:** `dashboard/app/(dashboard)/leads/page.tsx`

Seven columns matching `LeadStatus` enum:
```
NEW → QUALIFIED → SCORED → MESSAGED → REPLIED → MEETING → CLOSED
```

Each card shows:
- Company name + contact name
- Score tier badge: `HOT` (red) / `WARM` (amber) / `COLD` (blue)
- Source chip: LinkedIn / Google Maps / CSV
- Numeric score

Drag between columns calls `PATCH /api/v1/leads/:id/status`.

---

### B5 — Message approval queue

**File:** `dashboard/app/(dashboard)/messages/page.tsx`

Filterable list of `PENDING_APPROVAL` messages, grouped by lead. Each row:
- Lead name + company
- Message preview (truncated to 120 chars, expand on click)
- Approve button → `POST /api/v1/messages/:id/approve`
- Reject button + optional rejection note → `POST /api/v1/messages/:id/reject`

---

### B6 — Analytics dashboard

**File:** `dashboard/app/(dashboard)/analytics/page.tsx`

**Metric cards (last 30 days):**
| Metric | Endpoint field |
|--------|---------------|
| Total leads discovered | `summary.totalLeads` |
| By source breakdown | `summary.bySource` |
| Reply rate | `summary.replyRate` |
| Conversion rate (meetings / replied) | `summary.conversionRate` |
| Cost per lead (tokens) | `summary.costPerLead` |

**Charts:**
- Line chart — daily discovery volume by source
- Donut chart — source breakdown (LinkedIn / Google Maps / CSV)

Data from `GET /api/v1/analytics/summary?days=30`.

---

## Execution Order

| Step | Task | Blocking |
|------|------|---------|
| 1 | A1 — `prisma:generate` | Unblocks type safety for all other fixes |
| 2 | A2 + A3 — Session fixes | Prevents silent broken sessions |
| 3 | A4 + A5 — Stealth + rate limit | Reduces ban risk |
| 4 | A6 + A7 — Google Maps + confidence gate | Correctness fixes |
| 5 | A8 — `PROGRESS.md` update | Closes Phase 3 |
| 6 | B1 — Next.js bootstrap | Phase 4 foundation |
| 7 | B2 + B3 — API client + auth | Required before any page works |
| 8 | B4 — Lead board | Core user-facing feature |
| 9 | B5 — Message approval | Core workflow feature |
| 10 | B6 — Analytics | Reporting layer |

---

## Verification

### Phase 3 Checklist

```bash
npm run prisma:generate                                    # no TS errors after
npm test -- --testPathPattern=discovery-score-factor       # pass
npm test -- --testPathPattern=scoring-engine               # pass
npm test -- --testPathPattern=google-maps.adapter          # pass
npm run linkedin:test-live                                 # session + proxy logs, no crash
```

Manual checks:
- [ ] Trigger `daily-scrape.job.ts` via endpoint
- [ ] LinkedIn posts appear in DB with `source = 'linkedin'`
- [ ] Google Maps results appear with `source = 'google_maps'`
- [ ] Discovery leads have `scoreBreakdown.factors` containing `discovery`, not `intent`
- [ ] Leads appear with correct `tier` values
- [ ] No CAPTCHA triggered (stealth working)
- [ ] Proxy rotation logs visible in output

### Phase 4 Checklist

```bash
cd dashboard && npm run dev       # localhost:3000, no TS errors
```

Manual checks:
- [ ] Login form → redirects to lead board on success
- [ ] Lead board renders all 7 kanban columns
- [ ] Drag-and-drop moves a card and persists via API
- [ ] Messages page shows pending approvals with approve/reject
- [ ] Analytics page renders metric cards and charts

---

## Known Limitations (carried forward)

1. **LinkedIn phone/website** — post search doesn't expose contact details; enrichment stage handles separately.
2. **Google Maps website** — `textSearch` doesn't return `website`; a Place Details call per result is needed.
3. **LinkedIn 2FA** — system logs a warning but cannot auto-resolve; manual action or pre-authenticated cookie required.
4. **Playwright binaries** — `npx playwright install chromium` must be run after `npm install` in each new environment.
5. **LinkedIn multi-account** — only one `LINKEDIN_EMAIL` supported; no rotation if account gets restricted.
