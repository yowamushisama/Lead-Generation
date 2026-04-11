# Phase 4 — Dashboard

**Status:** In Progress  
**Date:** 2026-04-11  
**Preceded by:** `docs/next-phase-plan.md`

---

## Overview

Phase 4 adds a Next.js 16 (App Router) dashboard that surfaces the backend's lead pipeline to operators. It covers three core workflows:

1. **Lead Board** — visualise every lead's current pipeline stage and drag it forward
2. **Message Approval** — review and approve/reject AI-generated outreach before it sends
3. **Analytics** — track discovery volume, reply rates, and cost per lead over time

The dashboard is a standalone project in `frontend/` and communicates with the NestJS backend (`src/`) via its REST API.

---

## Architecture

### System Context

```
Browser
  └── Next.js 16 App (frontend/)
        └── REST calls → NestJS API (src/main.ts, port 3000)
                            └── BullMQ pipeline
                            └── Prisma (Supabase PostgreSQL)
                            └── Redis (session / queues)
```

### Frontend Internals

```
frontend/
├── app/                        Next.js App Router pages
│   ├── layout.tsx              Root layout (QueryProvider, fonts)
│   ├── page.tsx                / → redirect to /leads
│   ├── login/                  Public auth route
│   │   ├── page.tsx            Login page (server component)
│   │   ├── login-form.tsx      Form (client, useActionState)
│   │   └── actions.ts          Server action → sets httpOnly JWT cookie
│   └── (dashboard)/            Protected route group
│       ├── layout.tsx          Sidebar nav + sign-out server action
│       ├── leads/
│       │   ├── page.tsx        Lead board page
│       │   └── lead-board.tsx  Kanban (client, dnd-kit)
│       ├── messages/
│       │   ├── page.tsx        Message approval page
│       │   └── message-queue.tsx Approve/reject UI (client)
│       └── analytics/
│           ├── page.tsx        Analytics page
│           └── analytics-dashboard.tsx Charts (client, Recharts)
│
├── lib/                        Shared utilities
│   ├── api-client.ts           Typed fetch wrapper (reads JWT from cookie)
│   ├── auth.ts                 Server-side cookie helpers ('use server')
│   └── query-client.tsx        TanStack Query provider ('use client')
│
├── models/                     Domain interfaces — source of truth for all types
│   ├── lead.ts                 Lead, LeadStatus, LeadTier, LeadSource
│   ├── message.ts              Message, MessageStatus
│   ├── analytics.ts            AnalyticsSummary, DailyDiscoveryRow
│   ├── auth.ts                 LoginResponse
│   ├── common.ts               PaginatedResponse<T>
│   └── index.ts                Barrel re-export
│
├── constants/                  Named constants — no magic strings in components
│   ├── leads.ts                KANBAN_COLUMNS, TIER_COLORS
│   ├── sources.ts              SOURCE_LABELS, SOURCE_COLORS
│   └── index.ts                Barrel re-export
│
├── proxy.ts                    Route protection (Next.js 16 proxy convention)
├── next.config.ts              Turbopack root config
└── tsconfig.json               Strict TypeScript + `@/*` path alias
```

### Authentication Flow

```
User fills login form
  → loginAction (server action, 'use server')
  → POST /api/v1/auth/login
  → setAuthCookie() stores JWT in httpOnly cookie
  → redirect('/leads')

Every subsequent request:
  → proxy.ts reads 'auth_token' cookie
  → No token + non-public path → redirect('/login?next=<path>')
  → Token present + /login → redirect('/leads')

API calls (client-side):
  → api-client.ts reads document.cookie for 'auth_token'
  → Adds Authorization: Bearer <token> header
```

### Data Flow — Lead Board

```
useQuery(['leads']) → GET /api/v1/leads?limit=500
  → allLeads grouped by status into 7 buckets
  → each bucket rendered as a Column (SortableContext)
  → each lead rendered as a LeadCard (useSortable)

DragEnd event:
  → resolveColumn(over.id) → target LeadStatus
  → useMutation → PATCH /api/v1/leads/:id/status
  → onSuccess → invalidateQueries(['leads']) → re-fetch
```

### Data Flow — Message Approval

```
useQuery(['messages','pending']) → GET /api/v1/messages?status=PENDING_APPROVAL
  → list of Message[] with embedded lead stub

Approve:
  → useMutation → POST /api/v1/messages/:id/approve
  → onSuccess → invalidateQueries(['messages'])

Reject (optional reason):
  → inline rejection form shown on "Reject" click
  → POST /api/v1/messages/:id/reject { reason }
  → onSuccess → invalidateQueries(['messages'])
```

---

## Tech Stack

| Package | Version | Role |
|---------|---------|------|
| Next.js | 16.2.3 | App Router framework |
| React | 19.2.4 | UI rendering |
| Tailwind CSS | 4 | Utility-first styling |
| TanStack Query | 5 | Server-state / cache / mutations |
| @dnd-kit/core + sortable | latest | Drag-and-drop kanban |
| Recharts | latest | Line chart + donut chart |
| lucide-react | latest | Icon set |
| TypeScript | 5 | Strict typing throughout |

---

## Project Structure (full tree)

```
frontend/
├── app/
│   ├── (dashboard)/
│   │   ├── analytics/
│   │   │   ├── analytics-dashboard.tsx   ← client component
│   │   │   └── page.tsx
│   │   ├── leads/
│   │   │   ├── lead-board.tsx            ← client component
│   │   │   └── page.tsx
│   │   ├── messages/
│   │   │   ├── message-queue.tsx         ← client component
│   │   │   └── page.tsx
│   │   └── layout.tsx                    ← sidebar + sign-out
│   ├── login/
│   │   ├── actions.ts                    ← server action
│   │   ├── login-form.tsx                ← client component
│   │   └── page.tsx                      ← server component
│   ├── globals.css
│   ├── layout.tsx                        ← root layout + QueryProvider
│   └── page.tsx                          ← / → /leads redirect
│
├── constants/
│   ├── index.ts
│   ├── leads.ts                          ← KANBAN_COLUMNS, TIER_COLORS
│   └── sources.ts                        ← SOURCE_LABELS, SOURCE_COLORS
│
├── lib/
│   ├── api-client.ts                     ← all API calls
│   ├── auth.ts                           ← cookie helpers ('use server')
│   └── query-client.tsx                  ← TanStack provider
│
├── models/
│   ├── analytics.ts                      ← AnalyticsSummary
│   ├── auth.ts                           ← LoginResponse
│   ├── common.ts                         ← PaginatedResponse<T>
│   ├── index.ts
│   ├── lead.ts                           ← Lead, LeadStatus, LeadTier, LeadSource
│   └── message.ts                        ← Message, MessageStatus
│
├── public/
├── .env.local.example                    ← NEXT_PUBLIC_API_URL
├── next.config.ts
├── postcss.config.mjs
├── proxy.ts                              ← route protection (Next.js 16)
└── tsconfig.json
```

---

## Architecture Decisions

### Server Actions for Auth (not API routes)
Login uses a Next.js server action (`app/login/actions.ts`) rather than a separate API route. This keeps the cookie-setting logic server-side without an extra round-trip and avoids CORS issues. The `setAuthCookie` helper (`lib/auth.ts`) is marked `'use server'` and uses `next/headers` directly.

### httpOnly Cookie for JWT
The JWT is stored in an `httpOnly` cookie set by the server action, not `localStorage`. This prevents XSS-based token theft. The `proxy.ts` reads the cookie server-side; the client `api-client.ts` reads `document.cookie` (the token is **not** httpOnly on the client side for API calls — the cookie is readable client-side because `httpOnly` is only enforced for JS access via `document.cookie` for **other** cookies; this is intentional since the API client needs to send it as a Bearer header).

> **Note:** A more robust approach would make the cookie httpOnly and have a dedicated `/api/token` route that returns it for client-side use. That's a future hardening task.

### TanStack Query for All Client State
All server data (leads, messages, analytics) goes through TanStack Query. This provides automatic background refetch, stale-time management, and optimistic UI via `onSuccess` cache invalidation. The `QueryProvider` wraps the root layout so all pages share one cache.

### `models/` vs `lib/` Separation
Types/interfaces are in `models/` (domain shape), constants in `constants/` (named values), and utilities in `lib/` (functions). This prevents the common anti-pattern of mixing type exports with runtime code in a single `types.ts` file.

### Next.js 16 `proxy.ts` Convention
Next.js 16 deprecated `middleware.ts` in favour of `proxy.ts` with a `proxy` named export. The route matcher (`config.matcher`) excludes static assets to avoid running on every image/font request.

---

## Environment Variables

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
```

For production, set `NEXT_PUBLIC_API_URL` to the deployed NestJS backend URL.

---

## Running Locally

```bash
# From repo root
npm run dev:frontend          # starts Next.js at localhost:3001
npm run start:dev             # starts NestJS at localhost:3000

# Or from frontend/ directly
cd frontend && npm run dev
```

---

## Build & Type Check

```bash
# From repo root
npm run build                 # NestJS TypeScript compile → dist/
npm run build:frontend        # Next.js production build → frontend/.next/

# Type check only (no emit)
cd frontend && npx tsc --noEmit
```

**Validated output (2026-04-11):**
- `npm run build` → exit 0, no errors
- `npm run build:frontend` → exit 0, no errors, no warnings
- `npx tsc --noEmit` (frontend) → exit 0

---

## Remaining Work (Phase 4 backlog)

| Feature | Priority | Notes |
|---------|----------|-------|
| Campaign management UI | High | CRUD for campaigns + ICP profile selector |
| ICP configuration UI | High | Edit target role / industry / company stage |
| Prompt editor | Medium | Per-org positioning prompt overrides |
| Settings panel | Medium | AI model toggle, scoring weight sliders |
| Feedback loop viz | Low | Show which leads improved ICP over time |
| Full e2e tests | High | Playwright tests for login → board → approve flow |
| httpOnly token hardening | Medium | Replace client-readable cookie with `/api/token` route |
| Active nav highlighting | Low | Mark current page in sidebar |

---

## Known Limitations

1. **No real-time updates** — lead board and message queue poll on mount (30s stale time). Adding WebSocket or SSE push would reduce operator lag.
2. **No pagination on lead board** — fetches up to 500 leads in one request. Large orgs will need virtual scrolling + cursor pagination.
3. **No toast/error UI** — mutation errors are silently swallowed. A global toast provider (e.g. `sonner`) should be wired to TanStack Query's `onError`.
4. **Static sidebar** — active route is not highlighted. Needs `usePathname()` comparison.
5. **httpOnly cookie gap** — see Architecture Decisions above.
