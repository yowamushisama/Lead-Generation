# Obsidian Control Center — Dashboard Documentation

**AI Intent-Based Client Acquisition Engine**
Full-featured frontend for discovering, scoring, and converting high-intent B2B leads.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Design System](#design-system)
4. [Pages & Features](#pages--features)
5. [API Integration](#api-integration)
6. [Data Models](#data-models)
7. [Pipeline Architecture](#pipeline-architecture)
8. [Adapters](#adapters)
9. [Scoring Engine](#scoring-engine)
10. [Setup & Configuration](#setup--configuration)
11. [Component Library](#component-library)

---

## Overview

The Obsidian Control Center is a high-density, dark-themed intelligence dashboard designed for B2B marketers and growth teams running AI-powered client acquisition campaigns. It provides end-to-end visibility and control over the entire lead lifecycle:

```
Discovery → Intent Scoring → Enrichment → Personalization → Outreach → Conversion
```

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Lead Intelligence** | Excel-like table with live filtering, row expansion, scoring breakdown |
| **Pipeline Monitor** | Real-time pipeline flow visualization with queue depths and diagnostic logs |
| **Adapter Control** | Toggle and trigger LinkedIn, Google Maps, CSV, and Webhook adapters |
| **Message Queue** | Review and approve AI-generated outreach with split-panel editor |
| **Campaigns Hub** | Create campaigns, set ICP, monitor performance |
| **ICP Builder** | Configure Ideal Customer Profile with scoring weight visualization |
| **Analytics Command** | Funnel charts, conversion rates, source breakdown, token usage |
| **Diagnostics** | System health, error logs, failed pipeline jobs, compliance overview |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| React | React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 |
| Data Fetching | TanStack React Query v5 |
| Charts | Recharts v3 |
| Drag & Drop | @dnd-kit |
| Icons | Lucide React |
| Fonts | Syne (display) + IBM Plex Mono (data) + DM Sans (body) |

---

## Design System

### Aesthetic: Obsidian Control Center

High-density dark terminal aesthetic. Bloomberg meets modern SaaS. Power-user focused with rich data density, glowing status indicators, and animated pipeline flows.

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `base` | `#0A0A0F` | Main background |
| `surface` | `#12121A` | Card backgrounds |
| `elevated` | `#1A1A24` | Elevated cards, hover states |
| `overlay` | `#222232` | Modals, popovers |
| `gold` | `#F59E0B` | HOT leads, primary actions, urgent signals |
| `aqua` | `#06B6D4` | Data, active states, live indicators |
| `orchid` | `#7C3AED` | AI activity, pipeline, violet accent |
| `jade` | `#10B981` | Success, converted, health OK |
| `crimson` | `#EF4444` | Errors, critical, failed jobs |
| `tangerine` | `#F97316` | WARM leads, warnings |
| `ink` | `#F1F5F9` | Primary text |
| `mist` | `#94A3B8` | Secondary text |
| `dusk` | `#475569` | Muted/disabled text |

### Typography

| Role | Font | Weights |
|------|------|---------|
| Display headings | Syne | 500, 600, 700, 800 |
| Body text | DM Sans | 300, 400, 500, 600 |
| Numbers, scores, logs | IBM Plex Mono | 400, 500, 600 |

### Tier Color Coding

| Tier | Color | Border |
|------|-------|--------|
| HOT | `text-gold bg-gold/10` | `border-l-2 border-l-gold` |
| WARM | `text-tangerine bg-tangerine/10` | `border-l-2 border-l-tangerine` |
| COLD | `text-aqua bg-aqua/10` | `border-l-2 border-l-aqua` |

### Background

Dot-grid texture overlay on near-black background:
```css
background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
background-size: 24px 24px;
```

---

## Pages & Features

### 1. Command Center (`/`)

The home page and real-time overview of the entire system.

**Sections:**
- **System Health Bar** — Live polling of `/health/live` and `/health/ready` every 30s. Shows DB, Redis, queue connectivity.
- **KPI Row** — 6 stat cards: Total Leads, HOT Leads, Reply Rate, Conversion Rate, AI Tokens Used, Messages Pending
- **Pipeline Flow** — Animated SVG visualization of all 7 pipeline stages (intent → enrich → score → personalize → outreach → sent) with lead counts per stage
- **Today's Activity Feed** — Recent lead events, polled every 10s
- **Top HOT Leads** — Top 5 highest-scored leads with score bars
- **Adapter Status** — LinkedIn, Google Maps, CSV, Webhook — active/inactive with last-run time

### 2. Lead Intelligence (`/leads`)

The primary workspace for managing discovered leads.

**Dual View System:**
- **Table View** (default) — Sortable, filterable, paginated table
- **Kanban View** — Drag-and-drop board (original behavior preserved)

**Table Columns:**
| Column | Type | Notes |
|--------|------|-------|
| Name / Company | Text | Clickable for detail |
| Role | Text | Job title |
| Score | Progress bar | 0-100, colored by tier |
| Tier | Badge | HOT/WARM/COLD with glow |
| Source | Badge | LinkedIn/Maps/CSV/Webhook |
| Status | Dropdown | Inline editable |
| Intent Type | Badge | BUYING/HIRING/etc |
| Budget Signal | Text | Detected budget language |
| Created | Date | Relative time |

**Row Expansion:** Click any row to expand:
- 7-factor scoring breakdown with individual bars
- Pain points, fears, desires (AI-extracted)
- Intent reasoning
- Personalization data

**Source Toggle Tabs:** ALL | LinkedIn | Google Maps | CSV | Webhook

**Filters Panel:**
- Tier (HOT/WARM/COLD)
- Status (multi-select)
- Score range slider
- Industry search
- Date range picker
- Free-text search

**Bulk Actions:** Select rows → Update status / Delete / Export

### 3. Pipeline Monitor (`/pipeline`)

Real-time visualization of the AI processing pipeline.

**Flow Visualization:**
- 7 animated nodes: Intent → Enrich → Score → Personalize → Outreach → Send
- SVG arrows with animated dot progress between stages
- Each node: stage name, lead count, avg processing time

**Queue Status Panel:**
| Queue | Depth | Processing Rate | Last Job |
|-------|-------|-----------------|----------|

**Diagnostic Log Panel (right column):**
- Scrollable, auto-advancing log feed
- Log levels with color coding:
  - `INFO` — cyan
  - `WARN` — amber
  - `ERROR` — red
  - `DEBUG` — slate
- Filters: level, stage, lead ID
- Pause auto-scroll toggle
- Copy line button

**Failed Jobs Section:**
- List of failed pipeline jobs
- Error message + stack trace (expandable)
- Retry button per job

### 4. Adapters (`/adapters`)

Control panel for all four data source adapters.

**LinkedIn Adapter Card:**
- Session status (authenticated / needs login)
- Keywords input (comma-separated)
- Max results slider (10-500)
- Trigger scrape button
- Last run timestamp + leads ingested

**Google Maps Adapter Card:**
- Location input
- Industry input
- Max results slider
- Trigger discovery button
- Rate limit indicator (requests today / daily quota)

**CSV Adapter Card:**
- Drag-and-drop file upload zone
- Column mapping preview (detect name, email, company, role, etc.)
- Import button
- Previous imports table

**Webhook Adapter Card:**
- Webhook endpoint URL (copy button)
- HMAC signature key (reveal/hide)
- Recent webhook payloads log
- Payload schema reference

### 5. Message Queue (`/messages`)

Review and approve AI-generated outreach messages.

**Split-Panel Layout:**
- Left: Message list with filters
- Right: Full message editor

**Message List:**
- Lead name + company + tier badge
- Subject line preview
- Channel icon (LinkedIn DM / Email)
- Spam score + uniqueness score
- Quick approve/reject buttons

**Message Editor Panel:**
- Lead context card (score, tier, role, company, intent type)
- Editable subject field
- Editable message body (textarea)
- Spam score visualization
- AI model used
- Approve / Reject (with reason) buttons

**Filters:** By campaign, channel, lead tier

### 6. Campaigns (`/campaigns`)

Manage acquisition campaigns.

**Campaign Cards Grid:**
- Name + description
- Status badge (ACTIVE/PAUSED)
- Performance stats: Reply Rate, Conversion Rate, Leads Generated
- Pause/Resume toggle

**Create Campaign Modal:**
- Name, description
- ICP profile selection
- Source adapters to use (checkboxes)
- Target industries, locations
- Scoring weights override

**Campaign Detail:**
- Full performance metrics
- Lead funnel within campaign
- Message stats

### 7. ICP Builder (`/icp`)

Configure Ideal Customer Profiles that drive lead scoring.

**ICP Profile Cards:**
- Profile name + version
- Active/inactive toggle
- Conversion rate from learned weights
- Edit button

**ICP Configuration Form:**
- Target Roles — tag input (e.g., "CTO", "VP Engineering")
- Target Industries — tag input
- Company Stages — checkboxes (seed/early/growth/enterprise)
- Target Locations — tag input
- Buyer Signals — tag input (phrases that indicate buying intent)
- Urgency Signals — tag input
- Budget Signals — tag input

**Scoring Weight Visualizer:**
- 7 sliders (0-100) for intent, urgency, role, recency, budget, ICP fit, negative
- Live preview of score calculation

**Learned Weights Panel:**
- Machine-adjusted weights shown as delta from configured
- Conversion rate history chart

### 8. Analytics (`/analytics`)

Full analytics command center.

**Top Section — KPI Row:**
- Total Leads, HOT Leads, Reply Rate, Conversion Rate (prominent, with trend arrows)

**Pipeline Funnel Chart:**
- Full-width SVG funnel: NEW → ENRICHED → SCORED → PERSONALIZED → MESSAGE_DRAFTED → OUTREACH_SENT → CONVERTED
- Drop-off percentages between stages

**Charts Grid:**
- Daily Lead Volume — stacked area chart (HOT/WARM/COLD bands)
- Reply Rate Trend — line chart
- Source Breakdown — stacked bar chart (per source, colored by tier)
- AI Token Usage — bar chart with estimated cost

**Date Range Picker:** 7 / 14 / 30 / 90 days

**Top Industries Table:** Industry → Lead Count → Avg Score → Conversion Rate

**Export:** CSV download button

### 9. Diagnostics (`/diagnostics`)

System health and observability.

**Health Overview:**
- Database connection status
- Redis connection status
- Queue connectivity
- AI provider status (model + token budget)

**Pipeline Error Log:**
- Filtered view of failed/errored pipeline jobs
- Stage, lead ID, error message, timestamp
- Retry button

**Compliance Overview:**
- Total opted-out leads
- Data retention summary
- Leads expiring in next 30 days

---

## API Integration

### Base Configuration

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
```

### Authentication

JWT Bearer token stored in `auth_token` HTTP-only cookie. All API requests automatically attach `Authorization: Bearer <token>`.

### Available API Groups

| Group | Base Path | Key Operations |
|-------|-----------|---------------|
| Auth | `/api/v1/auth` | login, register, me |
| Leads | `/api/v1/leads` | list, get, update, bulkCreate, stats |
| Messages | `/api/v1/messages` | listPending, approve, reject |
| Campaigns | `/api/v1/campaigns` | CRUD, pause, resume, performance |
| ICP | `/api/v1/icp` | CRUD, stats |
| Analytics | `/api/v1/analytics` | dashboard, funnel, sources, trend |
| Conversations | `/api/v1/conversations` | list, get, replySuggestions |
| Health | `/health` | full, live, ready |
| Compliance | `/api/v1/compliance` | retentionSummary, optOut, exportLead |
| Organizations | `/api/v1/organizations` | me, stats, update |

### Standard Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "...",
  "timestamp": "2026-04-11T..."
}
```

---

## Data Models

### Lead

```typescript
interface Lead {
  id: string;
  name: string | null;
  company: string | null;
  role: string | null;
  email: string | null;
  location: string | null;
  score: number | null;          // 0-100
  tier: 'HOT' | 'WARM' | 'COLD' | null;
  status: LeadStatus;
  source: LeadSource;
  sourceType: 'intent' | 'discovery';
  intentType?: string;           // BUYING, HIRING, etc.
  intentUrgency?: string;        // CRITICAL, HIGH, MEDIUM, LOW
  intentConfidence?: number;     // 0-1
  budgetSignal?: string;
  painPoints?: string[];
  scoreBreakdown?: ScoringBreakdown;
  rating?: number | null;        // Google Maps rating
  reviewCount?: number | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}
```

### Lead Status Flow

```
NEW → ENRICHED → SCORED → PERSONALIZED → MESSAGE_DRAFTED → MESSAGE_APPROVED → OUTREACH_SENT → REPLIED → MEETING_BOOKED → CONVERTED
                                                                                                              ↓
                                                                                                         DISQUALIFIED
```

### Scoring Breakdown

```typescript
interface ScoringBreakdown {
  factors: {
    name: string;
    weight: number;
    score: number;
    maxPossible: number;
    reasoning: string;
  }[];
  totalScore: number;
  normalizedScore: number;
  tier: 'HOT' | 'WARM' | 'COLD';
}
```

---

## Pipeline Architecture

The AI pipeline processes leads through 5 async BullMQ queues:

```
Adapter Input
     ↓
intent queue      → IntentProcessor     (AI: classify buying intent)
     ↓
enrich queue      → EnrichmentProcessor (extract ICP attributes)
     ↓
score queue       → ScoringProcessor    (7-factor deterministic scoring)
     ↓
personalize queue → PersonalizationProcessor (4-layer personalization)
     ↓
outreach queue    → OutreachProcessor   (generate + anti-spam check message)
     ↓
Message record PENDING_APPROVAL → Human review → SENT
```

### 7 Scoring Factors

| Factor | Max Score | Description |
|--------|-----------|-------------|
| Intent | 30 | Confidence × 20 + type bonus (BUYING=10) |
| Urgency | 15 | CRITICAL=15, HIGH=10, MEDIUM=5, LOW=0 |
| Role Fit | 20 | C-suite=20, Director=15, Manager=10 |
| Recency | 15 | <7d=15, <30d=10, <90d=5 |
| Budget | 15 | Budget keywords detected |
| ICP Fit | 20 | Weighted match against ICP config |
| Negative | -30 | Penalty for complaints, competitors |

### Tier Thresholds (Intent Track)

| Tier | Score Range |
|------|------------|
| HOT | ≥ 20 |
| WARM | 10–19 |
| COLD | < 10 |

---

## Adapters

### LinkedIn Adapter

- Scrapes LinkedIn posts by keyword using Playwright (stealth mode)
- Requires: `LINKEDIN_EMAIL`, `LINKEDIN_PASSWORD` environment variables
- Proxy rotation supported
- Source type: `intent`

### Google Maps Adapter

- Discovers businesses via Google Places API
- Requires: `GOOGLE_MAPS_API_KEY` environment variable
- Rate limited: 200ms per query, 2000ms per page
- Source type: `discovery`

### CSV Adapter

- Imports leads from CSV/Excel files
- Auto-detects columns: name, email, company, role, industry, location, etc.
- Source type: `discovery`

### Webhook Adapter

- Receives leads via HTTP POST
- HMAC signature verification (configurable secret)
- Source type: `intent`

---

## Setup & Configuration

### Prerequisites

- Node.js 20+
- Backend NestJS API running (default: `localhost:3000`)
- Redis (Upstash or local)
- PostgreSQL via Supabase (with pgvector extension)

### Environment Variables

Copy `frontend/.env.local.example` to `frontend/.env.local`:

```bash
# Required
NEXT_PUBLIC_API_URL=http://localhost:3000

# Optional (for Supabase auth features)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
cd frontend
npm install
npm run dev
```

Dashboard available at: `http://localhost:3001` (or next available port)

### Production Build

```bash
cd frontend
npm run build
npm start
```

---

## Component Library

Located at `frontend/components/ui/`:

| Component | File | Description |
|-----------|------|-------------|
| `<Badge>` | `badge.tsx` | Status/tier badges with glow variants |
| `<Card>` | `card.tsx` | Dark glass card container |
| `<StatCard>` | `stat-card.tsx` | KPI metric card with trend arrow |
| `<DataTable>` | `data-table.tsx` | Sortable/filterable table with pagination |
| `<SourceToggle>` | `source-toggle.tsx` | Adapter source filter tabs |
| `<ScoreBar>` | `score-bar.tsx` | Visual score breakdown with factor bars |
| `<LogEntry>` | `log-entry.tsx` | Diagnostic log line with level color |
| `<Toast>` | `toast.tsx` | Toast notification system |

### Usage Examples

```tsx
// Status badge
<Badge variant="hot">HOT</Badge>
<Badge variant="status" status="OUTREACH_SENT">Outreach Sent</Badge>

// KPI stat card
<StatCard
  label="Conversion Rate"
  value="12.4%"
  trend="+2.1%"
  trendUp={true}
  icon={<TrendingUp />}
  accent="gold"
/>

// Score bar with breakdown
<ScoreBar
  score={78}
  tier="HOT"
  breakdown={lead.scoreBreakdown}
/>

// Source toggle
<SourceToggle
  value={activeSource}
  onChange={setActiveSource}
  counts={{ all: 342, linkedin: 120, google_maps: 89, csv: 133 }}
/>

// Log entry
<LogEntry
  level="ERROR"
  stage="score"
  message="Lead scoring failed: missing intent data"
  timestamp="2026-04-11T14:23:11Z"
  leadId="abc123"
/>
```

---

## Key Design Decisions

1. **Dual-view leads** — Table by default (more information density), Kanban for visual pipeline management. Users can toggle freely.

2. **Inline status editing** — Change lead status directly in the table without opening a modal. Optimistic updates with React Query mutation.

3. **Diagnostic logs are frontend-simulated** — Since the backend doesn't expose a WebSocket log stream, the diagnostic panel polls analytics + health endpoints and constructs a log-like display. Future: add WebSocket support to NestJS for real-time log streaming.

4. **Adapter triggers are direct API calls** — Triggering a LinkedIn scrape calls the appropriate adapter endpoint; the queue processes asynchronously and React Query polls for results.

5. **Score breakdown is stored in lead record** — The `scoreBreakdown` JSON field on the Lead model contains all 7 factor scores, enabling rich in-table visualization without additional API calls.

6. **ICP weight sliders are local-optimistic** — When editing ICP weights, a live preview score is computed client-side using the same formula as the backend scoring engine.

---

*Generated: 2026-04-11 | Engine: AI Client Acquisition Engine v1.0*
