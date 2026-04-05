# AI Intent-Based Client Acquisition Engine — MVP Implementation Plan

## 1. Product Vision

Build a **fully automated, multi-pipeline client acquisition system** that detects high-intent buyers across social platforms, enriches their profiles against a dynamic ICP model, scores them deterministically, generates deeply personalized outreach, and feeds conversion data back to continuously improve targeting.

> **One-liner:** "Find people already looking for your service and help you close them — automatically."

---

## 2. Critical Evaluation — Risks, Cons, and Mitigations

Before building, here are the **hard truths** about this concept and how we solve each one:

> [!CAUTION]
> ### Risk 1: LinkedIn Scraping is Legally Fragile
> LinkedIn actively sues scrapers, bans accounts, and rate-limits aggressively. A LinkedIn-only product is a **single point of failure** that can be shut down overnight.
>
> **Mitigation:** Abstract data collection behind a **Source Adapter interface**. LinkedIn is ONE adapter. We also build adapters for Twitter/X, Reddit, IndieHackers, HackerNews, Upwork job posts, and webhook-based manual input. The system is **platform-agnostic** by design.

> [!CAUTION]
> ### Risk 2: "Intent" ≠ "Qualified Lead" — False Positive Problem
> Someone posting "looking for a developer" might be venting, might have already hired, or might be a competitor fishing. Naive keyword matching will produce 60-70% garbage.
>
> **Mitigation:** Multi-signal validation. A single post is NOT enough. We cross-reference:
> - Recency (posted < 48hrs)
> - Profile signals (are they actually a founder/decision-maker?)
> - Activity pattern (are they responding to comments? still active?)
> - Historical data (have we seen them before? did they convert?)
>
> Plus a **confidence threshold** — only leads above 0.80 confidence proceed.

> [!WARNING]
> ### Risk 3: AI-Personalized Messages Still Feel Like Spam in 2026
> Every tool now generates "personalized" outreach. Buyers are fatigued. If your messages read like every other AI tool, you're dead.
>
> **Mitigation:** The 3-layer personalization model is good, but we add a **4th layer: Anti-Pattern Detection**. Before sending, AI checks the message against a database of "burnt patterns" (overused openers, cliché CTAs). If it matches common spam patterns, it rewrites. We also enforce **message diversity** — no two messages within a campaign share the same structure.

> [!WARNING]
> ### Risk 4: No Feedback = Flying Blind
> Without tracking what actually converts, the system degrades over time rather than improving.
>
> **Mitigation:** The feedback loop is not a "nice to have" — it's **Phase 1 core**. Every lead gets tracked through: Generated → Sent → Replied → Meeting → Closed. This data feeds back into scoring weights and ICP refinement automatically.

> [!IMPORTANT]
> ### Risk 5: Cold Outreach Deliverability is Declining
> Email spam filters in 2026 are aggressive. LinkedIn connection messages have low acceptance rates from strangers.
>
> **Mitigation:** The system doesn't just generate messages — it recommends the **optimal channel** per lead. Some leads are better reached via:
> - A thoughtful LinkedIn comment FIRST (warm-up), then DM
> - Twitter reply → DM funnel
> - Reddit comment providing value → DM
> The engagement strategy is multi-touch, not blast-and-pray.

> [!IMPORTANT]
> ### Risk 6: GDPR/Privacy Compliance is Non-Negotiable
> Processing personal data (names, roles, company info) from public profiles requires a lawful basis under GDPR.
>
> **Mitigation:**
> - All data processing claims **"legitimate interest"** basis with documented LIA
> - Built-in data retention policies (auto-delete after 90 days if no engagement)
> - Opt-out / right-to-delete API endpoint
> - Data minimization — we only store what's needed for outreach
> - Privacy policy template included

> [!NOTE]
> ### Risk 7: LLMs Are Bad at Math — Don't Use AI for Scoring
> Using an LLM to output a "lead score" of 85/100 is unreliable and non-reproducible.
>
> **Mitigation:** Lead scoring is **100% deterministic** — rule-based with weighted factors. AI is used to EXTRACT attributes ("is this person a founder?" → yes/no), but the MATH is done by code. This makes scores reproducible, debuggable, and tunable.

> [!NOTE]
> ### Risk 8: "Fully Automated" ≠ "No Human Oversight"
> Fully autonomous outreach will eventually send an embarrassing message. It always does.
>
> **Mitigation:** **Human-in-the-loop checkpoints**:
> - HOT leads (score > 20): Auto-generate message, **require human approval** before send
> - WARM leads (score 10-20): Auto-generate, auto-queue with 2hr review window
> - The dashboard shows all pending messages for quick approve/edit/reject

---

## 3. Enhanced Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOURCE ADAPTERS (Plugin-Based)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│  │ LinkedIn │ │ Twitter  │ │  Reddit  │ │  Manual  │ │Webhook│ │
│  │ Adapter  │ │ Adapter  │ │ Adapter  │ │  Import  │ │  API  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬───┘ │
│       └──────┬─────┴──────┬─────┴──────┬─────┴──────┬─────┘     │
└──────────────┼────────────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PIPELINE ORCHESTRATOR (Event-Driven)             │
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│   │  Intent   │───▶│   ICP    │───▶│  Lead    │───▶│  Person- │  │
│   │ Detector  │    │ Enricher │    │ Scorer   │    │ alizer   │  │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│        │                │              │               │         │
│        ▼                ▼              ▼               ▼         │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│   │ Outreach  │───▶│  Convo   │───▶│ Feedback │───▶│   ICP    │  │
│   │Generator │    │Assistant │    │  Loop    │    │ Refiner  │  │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
               │                                          ▲
               ▼                                          │
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │PostgreSQL│  │  Redis   │  │  Vector  │  │   Event Queue    │ │
│  │  (Core)  │  │ (Cache)  │  │  Store   │  │   (BullMQ)       │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DASHBOARD (Web UI)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Lead    │  │ Message  │  │Analytics │  │ Settings │        │
│  │  Board   │  │  Queue   │  │  Panel   │  │  Panel   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Backend** | Node.js + Express | Non-blocking I/O perfect for scraping + API calls |
| **Database** | PostgreSQL (not MongoDB) | Leads are relational data — scoring, campaigns, conversations. SQL wins here. |
| **Queue** | BullMQ (Redis-backed) | Each pipeline stage is a job. Retry, delay, rate-limit built-in. |
| **AI Provider** | OpenAI (GPT-4o-mini for classification, GPT-4o for personalization) | Cost-efficient where possible, quality where it matters |
| **Cache** | Redis | Rate limit tracking, session data, deduplication |
| **Vector Store** | pgvector (PostgreSQL extension) | Keep stack simple — no separate vector DB service needed |
| **Dashboard** | Vite + React | Fast, modern, great DX |
| **Scraping** | Playwright (LinkedIn), API-based (Twitter, Reddit) | Playwright for rendered pages; APIs where available |

---

## 4. Proposed Project Structure

```
Lead Generation/
├── package.json
├── .env.example
├── .env
├── docker-compose.yml              # PostgreSQL + Redis for local dev
├── prisma/
│   └── schema.prisma               # Database schema
│
├── src/
│   ├── index.js                     # App entry point
│   ├── config/
│   │   ├── index.js                 # Env config loader
│   │   ├── ai.config.js             # AI model settings, prompts versioning
│   │   └── scoring.config.js        # Lead scoring weights (tunable)
│   │
│   ├── adapters/                    # 🔌 SOURCE ADAPTERS (plugin-based)
│   │   ├── base.adapter.js          # Abstract base class
│   │   ├── linkedin.adapter.js      # LinkedIn scraper (Playwright)
│   │   ├── twitter.adapter.js       # Twitter/X API adapter
│   │   ├── reddit.adapter.js        # Reddit API adapter
│   │   ├── webhook.adapter.js       # Manual/webhook data input
│   │   └── csv.adapter.js           # CSV bulk import adapter
│   │
│   ├── pipeline/                    # ⚙️ PIPELINE STAGES
│   │   ├── orchestrator.js          # Pipeline orchestrator (BullMQ flows)
│   │   ├── intent-detector.js       # AI intent classification
│   │   ├── icp-enricher.js          # ICP attribute extraction
│   │   ├── lead-scorer.js           # Deterministic scoring engine
│   │   ├── personalizer.js          # 4-layer personalization
│   │   ├── outreach-generator.js    # Message generation
│   │   ├── conversation-assistant.js # Reply handling + suggestions
│   │   └── icp-refiner.js           # Feedback-driven ICP updates
│   │
│   ├── ai/                          # 🧠 AI PROVIDERS
│   │   ├── provider.js              # AI provider interface
│   │   ├── openai.provider.js       # OpenAI implementation
│   │   ├── prompts/                 # Versioned prompt templates
│   │   │   ├── intent-detection.js
│   │   │   ├── icp-extraction.js
│   │   │   ├── personalization.js
│   │   │   ├── outreach.js
│   │   │   ├── conversation.js
│   │   │   └── anti-pattern.js      # Spam pattern detector
│   │   └── prompt-manager.js        # A/B testing for prompts
│   │
│   ├── scoring/                     # 📊 DETERMINISTIC SCORING
│   │   ├── engine.js                # Score calculator
│   │   ├── factors.js               # Scoring factor definitions
│   │   └── thresholds.js            # HOT/WARM/COLD thresholds
│   │
│   ├── api/                         # 🌐 REST API
│   │   ├── routes/
│   │   │   ├── leads.routes.js
│   │   │   ├── campaigns.routes.js
│   │   │   ├── messages.routes.js
│   │   │   ├── analytics.routes.js
│   │   │   ├── settings.routes.js
│   │   │   └── privacy.routes.js    # GDPR endpoints
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── rateLimiter.js
│   │   │   └── validator.js
│   │   └── index.js
│   │
│   ├── services/                    # 🔧 BUSINESS LOGIC
│   │   ├── lead.service.js
│   │   ├── campaign.service.js
│   │   ├── message.service.js
│   │   ├── analytics.service.js
│   │   ├── deduplication.service.js # Prevent duplicate leads
│   │   └── compliance.service.js    # GDPR / data retention
│   │
│   ├── db/                          # 💾 DATA ACCESS
│   │   ├── prisma.js                # Prisma client singleton
│   │   ├── redis.js                 # Redis client
│   │   └── migrations/             # Auto-managed by Prisma
│   │
│   ├── jobs/                        # ⏰ SCHEDULED JOBS
│   │   ├── scheduler.js             # Cron-based job scheduler
│   │   ├── daily-scrape.job.js      # Daily data collection
│   │   ├── data-retention.job.js    # Auto-delete old data (GDPR)
│   │   └── analytics-rollup.job.js  # Daily metrics aggregation
│   │
│   └── utils/
│       ├── logger.js
│       ├── deduplicator.js
│       └── rate-limiter.js
│
├── dashboard/                       # 🖥️ WEB DASHBOARD (Vite + React)
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css                # Design system
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # Overview + metrics
│   │   │   ├── Leads.jsx            # Lead board (kanban)
│   │   │   ├── Messages.jsx         # Outreach queue + approval
│   │   │   ├── Conversations.jsx    # Active conversations
│   │   │   ├── Analytics.jsx        # Performance analytics
│   │   │   ├── ICPConfig.jsx        # ICP configuration
│   │   │   └── Settings.jsx         # System settings
│   │   ├── components/
│   │   │   ├── LeadCard.jsx
│   │   │   ├── MessagePreview.jsx
│   │   │   ├── ScoreIndicator.jsx
│   │   │   ├── PipelineVisualization.jsx
│   │   │   └── ...
│   │   └── hooks/
│   │       ├── useLeads.js
│   │       ├── useAnalytics.js
│   │       └── ...
│   └── public/
│
├── tests/
│   ├── unit/
│   │   ├── scoring.test.js
│   │   ├── intent-detector.test.js
│   │   └── personalizer.test.js
│   ├── integration/
│   │   └── pipeline.test.js
│   └── fixtures/
│       ├── sample-posts.json
│       └── sample-leads.json
│
└── docs/
    ├── ARCHITECTURE.md
    ├── PRIVACY.md
    └── API.md
```

---

## 5. Core Data Models (Prisma Schema)

```prisma
model Lead {
  id              String    @id @default(uuid())
  externalId      String?   // Platform-specific ID
  source          String    // "linkedin", "twitter", "reddit", "manual"
  sourceUrl       String?
  
  // Profile
  name            String
  headline        String?
  bio             String?
  role            String?   // "Founder", "CTO", etc.
  company         String?
  companySize     String?
  industry        String?
  location        String?
  
  // Intent
  originalContent String    // The post/comment that triggered detection
  intentType      String?   // "MVP Development", "Hiring", etc.
  intentUrgency   String?   // "High", "Medium", "Low"
  intentConfidence Float?   // 0.0 - 1.0
  isBuyer         Boolean   @default(false)
  
  // ICP Enrichment
  companyStage    String?   // "Pre-seed", "Seed", "Series A", etc.
  technicalLevel  String?   // "Non-technical", "Semi-technical", "Technical"
  budgetSignal    String?   // "High", "Medium", "Low"
  hiringIntent    Boolean   @default(false)
  painPoints      Json?     // Array of identified pain points
  fears           Json?     // Array of fears
  desires         Json?     // Array of desires
  
  // Scoring
  score           Int       @default(0)
  scoreBreakdown  Json?     // { factor: points }
  tier            String    @default("COLD") // "HOT", "WARM", "COLD"
  
  // Personalization
  personalContext Json?     // Layer 1: Context
  psychology      Json?     // Layer 2: Psychology
  positioning     Json?     // Layer 3: Positioning
  toneProfile     String?   // "formal", "casual", "direct"
  
  // Pipeline state
  status          String    @default("NEW") // NEW → QUALIFIED → MESSAGED → REPLIED → MEETING → CLOSED → LOST
  
  // Relationships
  messages        Message[]
  conversations   Conversation[]
  campaign        Campaign?  @relation(fields: [campaignId], references: [id])
  campaignId      String?
  
  // Compliance
  consentStatus   String    @default("LEGITIMATE_INTEREST")
  optedOut        Boolean   @default(false)
  dataExpiresAt   DateTime  // Auto-delete date
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@unique([externalId, source])
  @@index([tier, status])
  @@index([score])
  @@index([source])
}

model Message {
  id              String    @id @default(uuid())
  lead            Lead      @relation(fields: [leadId], references: [id])
  leadId          String
  
  type            String    // "INITIAL", "FOLLOWUP", "REPLY"
  channel         String    // "linkedin_dm", "twitter_dm", "email", "linkedin_comment"
  content         String
  personalContext Json?     // Why this message was generated this way
  
  status          String    @default("DRAFT") // DRAFT → APPROVED → SENT → DELIVERED → REPLIED
  approvedBy      String?
  sentAt          DateTime?
  repliedAt       DateTime?
  
  // Anti-spam
  spamScore       Float?    // 0.0 = not spammy, 1.0 = very spammy
  uniquenessScore Float?    // How different from recent messages
  
  promptVersion   String?   // Which prompt version generated this
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([leadId])
  @@index([status])
}

model Conversation {
  id              String    @id @default(uuid())
  lead            Lead      @relation(fields: [leadId], references: [id])
  leadId          String
  
  messages        Json      // Array of { role, content, timestamp }
  suggestedReply  String?
  objectionType   String?   // "pricing", "timing", "trust", etc.
  sentiment       String?   // "positive", "neutral", "negative"
  
  status          String    @default("ACTIVE") // ACTIVE, STALE, CONVERTED, LOST
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([leadId])
}

model Campaign {
  id              String    @id @default(uuid())
  name            String
  description     String?
  
  // ICP Configuration
  icpConfig       Json      // Target ICP for this campaign
  keywords        Json      // Search keywords
  sources         Json      // Active source adapters
  
  // Scoring overrides
  scoringWeights  Json?     // Custom weights for this campaign
  
  // Stats
  leadsGenerated  Int       @default(0)
  messagesSent    Int       @default(0)
  replies         Int       @default(0)
  meetings        Int       @default(0)
  conversions     Int       @default(0)
  
  leads           Lead[]
  
  status          String    @default("ACTIVE")
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model ICPProfile {
  id              String    @id @default(uuid())
  name            String
  version         Int       @default(1)
  
  // Base criteria
  targetRoles     Json      // ["Founder", "CEO", "CTO"]
  targetIndustries Json     // ["SaaS", "E-commerce"]
  targetStages    Json      // ["Pre-seed", "Seed"]
  
  // Behavioral signals
  buyerSignals    Json      // Keywords and patterns
  urgencySignals  Json
  budgetSignals   Json
  
  // Learned weights (from feedback loop)
  learnedWeights  Json?
  
  isActive        Boolean   @default(true)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model AnalyticsEvent {
  id              String    @id @default(uuid())
  eventType       String    // "lead_created", "message_sent", "reply_received", etc.
  entityType      String    // "lead", "message", "campaign"
  entityId        String
  metadata        Json?
  
  createdAt       DateTime  @default(now())
  
  @@index([eventType, createdAt])
  @@index([entityType, entityId])
}
```

---

## 6. Pipeline Stage Details

### Stage 1: Source Adapters

Each adapter implements the `BaseAdapter` interface:

```javascript
// base.adapter.js
class BaseAdapter {
  async search(keywords, options) { throw new Error('Not implemented') }
  async collectPosts(query)       { throw new Error('Not implemented') }
  async enrichProfile(profileId)  { throw new Error('Not implemented') }
  normalize(rawData) → LeadInput  { throw new Error('Not implemented') }
}
```

**MVP adapters (Phase 1):**
- `linkedin.adapter.js` — Playwright-based, searches posts/comments by keyword
- `csv.adapter.js` — Bulk import from CSV
- `webhook.adapter.js` — Accept leads via API POST

**Phase 2 adapters:**
- `twitter.adapter.js` — Twitter API v2
- `reddit.adapter.js` — Reddit API (subreddits: r/startups, r/SaaS, r/forhire)
- `indiehackers.adapter.js` — IndieHackers scraper

### Stage 2: Intent Detection

AI classifies each raw lead with structured output:

```javascript
// Output schema
{
  is_buyer: boolean,
  need: string,        // "MVP Development", "AI Integration", etc.
  urgency: "high" | "medium" | "low",
  confidence: number,  // 0.0 - 1.0  
  reasoning: string    // AI's explanation (for debugging)
}
```

**Threshold:** Only leads with `is_buyer === true && confidence >= 0.80` proceed.

### Stage 3: ICP Enrichment

Extracts structured attributes from bio, headline, post content, and company data:

```javascript
{
  role: "Non-technical founder",
  company_stage: "Pre-seed",
  industry: "SaaS",
  technical_level: "Non-technical",
  budget_signal: "Medium",
  hiring_intent: true,
  pain_points: ["Needs MVP but lacks tech knowledge"],
  fears: ["Getting overcharged", "Hiring wrong team"],
  desires: ["Launch fast", "Validate idea"],
  personality: "direct"
}
```

### Stage 4: Lead Scoring (Deterministic)

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
| Returning lead (seen before) | +3 | Dedup Service |
| **Negative: Competitor profile** | **-10** | ICP Enricher |
| **Negative: Already hired** | **-15** | Intent Detector |

**Tiers:**
- 🔴 **HOT** (20+): Immediate action — generate message, queue for approval
- 🟡 **WARM** (10-19): Queue for batch review
- ⚪ **COLD** (0-9): Archive, monitor for re-engagement

### Stage 5: 4-Layer Personalization

| Layer | What | Source |
|-------|------|--------|
| **Context** | What they said, exact problem | Their post/comment |
| **Psychology** | Fears, desires, personality type | ICP enrichment |
| **Positioning** | How YOUR offer solves THEIR problem | Campaign config |
| **Anti-Pattern** | Ensure message doesn't match spam patterns | Pattern database |

### Stage 6: Outreach Generation

Formula: `[Context Reference] + [Pain Alignment] + [Insight/Authority] + [Soft CTA]`

Each message is checked against:
- Spam pattern database (reject if > 0.6 similarity to known patterns)
- Recent message history (reject if > 0.7 similarity to last 50 messages sent)
- Grammar/tone consistency

### Stage 7: Conversation Assistant

When leads reply:
- Classify sentiment (positive / neutral / objection / rejection)
- Identify objection type (pricing, timing, trust, scope)
- Generate contextual reply suggestion
- Provide closing strategy recommendation

### Stage 8: Feedback Loop

Every status change generates an `AnalyticsEvent`. Weekly batch job:
1. Calculates conversion rates by ICP segment
2. Identifies which scoring factors correlate with actual conversions
3. Adjusts scoring weights (+/- 10% per cycle)
4. Identifies underperforming message templates
5. Updates ICP profile `learnedWeights`

---

## 7. Multi-Pipeline Flexibility

The **Source Adapter** pattern makes this truly platform-agnostic:

```
┌─ linkedin.adapter.js ─┐
│  search("looking for   │      ┌──────────────────┐
│   developer")          │─────▶│                  │
└────────────────────────┘      │   UNIFIED LEAD   │
┌─ twitter.adapter.js ──┐      │    SCHEMA        │
│  search("#buildinpublic│─────▶│   (normalized)   │
│   need developer")     │      │                  │
└────────────────────────┘      │  → Same pipeline │
┌─ reddit.adapter.js ───┐      │  → Same scoring  │
│  search(r/startups,    │─────▶│  → Same AI       │
│   "need MVP help")     │      │                  │
└────────────────────────┘      └──────────────────┘
┌─ webhook.adapter.js ──┐              │
│  POST /api/leads/ingest│─────────────┘
└────────────────────────┘
```

**Adding a new source = writing one adapter file.** No pipeline changes needed.

---

## 8. User Review Required

> [!IMPORTANT]
> ### Database Choice: PostgreSQL vs MongoDB
> I'm recommending **PostgreSQL** over the originally proposed MongoDB. Leads have strong relational structures (leads → messages → conversations → campaigns). PostgreSQL + Prisma gives us type safety, migrations, and pgvector for embeddings. **Do you agree, or prefer MongoDB?**

> [!IMPORTANT]
> ### Dashboard Framework: React (Vite) vs Vanilla HTML
> For the dashboard, I recommend **Vite + React** since you'll need real-time updates, complex state (lead kanban, message approval queue), and many interactive components. A vanilla HTML approach would be limiting here. **Approved?**

> [!IMPORTANT]
> ### AI Provider: OpenAI vs Claude vs Both
> For MVP, I recommend **OpenAI** (GPT-4o-mini for classification tasks at ~$0.15/1M tokens, GPT-4o for personalization). We can add Claude as a fallback later. **Your preference?**

> [!WARNING]
> ### LinkedIn Scraping Strategy
> LinkedIn scraping via Playwright is the riskiest component. For MVP, I can build it, but we should plan for a **"degradation mode"** where the system continues to function via other adapters if LinkedIn blocks us. I'll also build the CSV adapter for manual lead import as a safe fallback. **Acceptable risk?**

---

## 9. Phased Execution Plan

### Phase 1 — Foundation (Week 1)
- [ ] Project initialization (Node.js, Prisma, PostgreSQL, Redis)
- [ ] Database schema + migrations
- [ ] Config system + environment management
- [ ] Base adapter interface + CSV adapter + webhook adapter
- [ ] BullMQ pipeline orchestrator skeleton
- [ ] Basic API routes (leads CRUD)
- [ ] Logger + error handling

### Phase 2 — AI Pipeline Core (Week 2)
- [ ] AI provider abstraction + OpenAI implementation
- [ ] Prompt templates (intent, ICP, personalization, outreach)
- [ ] Intent detection pipeline stage
- [ ] ICP enrichment pipeline stage
- [ ] Deterministic lead scoring engine
- [ ] 4-layer personalization engine
- [ ] Outreach message generator
- [ ] Anti-pattern spam detector
- [ ] Pipeline integration tests

### Phase 3 — LinkedIn + Conversation (Week 3)
- [ ] LinkedIn adapter (Playwright)
- [ ] Deduplication service
- [ ] Conversation assistant
- [ ] Reply classification + objection handling
- [ ] Scheduled jobs (daily scrape, data retention)
- [ ] Campaign management API
- [ ] Analytics event tracking

### Phase 4 — Dashboard + Feedback Loop (Week 4)
- [ ] Dashboard: Project setup (Vite + React)
- [ ] Dashboard: Lead board (kanban view)
- [ ] Dashboard: Message approval queue
- [ ] Dashboard: Analytics panel
- [ ] Dashboard: ICP configuration
- [ ] Dashboard: Campaign management
- [ ] Feedback loop — scoring weight adjustment
- [ ] ICP refinement from conversion data
- [ ] GDPR compliance endpoints
- [ ] End-to-end testing

---

## 10. Verification Plan

### Automated Tests
```bash
npm run test:unit        # Scoring engine, intent detection, personalization
npm run test:integration # Full pipeline with mock data
npm run test:e2e         # API endpoint testing
```

### Manual Verification
- Process 10 sample LinkedIn posts through pipeline manually
- Verify scoring produces consistent results
- Review AI-generated messages for quality
- Test dashboard UI in browser
- Verify GDPR data deletion flow

---

## 11. Open Questions

1. **Which agency services are you offering?** (Dev, AI, automation, marketing — all of them?) This affects the positioning layer prompts.
2. **Do you have OpenAI API keys ready**, or should I build with mock AI responses first?
3. **How many leads per day do you want to process?** This affects rate limiting and cost estimates.
4. **Do you want the dashboard yet in Phase 1**, or should we focus purely on the backend pipeline first and add the dashboard later?
