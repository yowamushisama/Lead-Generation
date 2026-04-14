# CAE Feature Priorities — Business-Critical Product Spec

## Purpose

This document defines the features CAE should develop next from a business point of view.

The goal is not to add more surface area. The goal is to strengthen CAE's core value proposition:

**Find active demand, qualify it accurately, and convert it into high-quality outreach faster than manual sales workflows.**

---

## Product USP

**CAE is an intent-to-outreach engine for B2B teams.**

It should help a business:

- detect prospects already showing buying or expansion signals
- qualify them against a configurable ICP
- generate outreach tied to real context
- let operators review, approve, and learn from conversion outcomes

This means the next feature cycle should prioritize:

1. better campaign control
2. better qualification control
3. better messaging control
4. better conversion learning
5. better operational trust

---

## Priority Framework

Every feature should be judged against at least one of these outcomes:

- Better leads
- Better qualification
- Faster operator action
- More reliable execution
- More measurable conversion learning

If a feature does not improve one of the above, it is not urgent right now.

---

## P0 — Must Build Now

## 1. Campaign Management UI

### Why this matters

The backend campaign module exists, but without a real campaign workflow the product feels like a set of tools instead of a client acquisition system.

Campaigns should become the main business object that connects:

- source selection
- ICP targeting
- outreach strategy
- performance measurement

### User stories

- As a growth operator, I want to create a campaign for a specific offer so CAE can target the right leads.
- As a sales manager, I want to pause or resume a campaign so I can control lead flow.
- As an operator, I want to see campaign performance so I know which acquisition motion is working.

### What to build

- Campaign list page
- Campaign creation flow
- Campaign detail page
- Campaign status controls
- Campaign-level analytics
- Campaign-to-ICP assignment
- Campaign-to-message linkage

### Required fields

- Campaign name
- Campaign objective
- Offer / service category
- Target region
- Lead source selection
- Linked channels
- Assigned ICP profile
- Daily lead cap
- Daily outreach cap
- Approval mode
- Campaign status

### Recommended statuses

- Draft
- Active
- Paused
- Archived

### Required actions

- Create campaign
- Edit campaign
- Pause campaign
- Resume campaign
- Archive campaign
- View leads under campaign
- View pending messages under campaign
- View conversion metrics under campaign

### Dependencies in current codebase

- `src/campaigns/`
- `frontend/app/(dashboard)/campaigns/`

### Success metric

- A user can launch and manage a campaign without backend intervention.
- Every lead and message can be traced back to a campaign.
- Campaign-level reply and conversion reporting is available.

---

## 2. ICP Builder UI

### Why this matters

CAE's business value depends on qualification quality. If ICP setup is weak, scoring quality becomes weak, which damages trust in the system.

### User stories

- As a business user, I want to define my ideal customer profile without editing code.
- As an operator, I want to tune scoring weights so CAE prioritizes leads that actually match our market.
- As a manager, I want to exclude bad-fit leads so the team does not waste time reviewing noise.

### What to build

- ICP list page
- Create/edit ICP profile
- Weight tuning interface
- Mandatory vs preferred criteria controls
- Exclusion rules
- Tier threshold controls
- Score explanation preview

### Required fields

- ICP name
- Target industries
- Company size range
- Geography
- Buyer roles / seniority
- Offer-relevant pain points
- Budget indicators
- Urgency indicators
- Buying-intent keywords
- Excluded roles
- Excluded industries
- Negative signals

### Scoring controls

- Weight for industry fit
- Weight for role fit
- Weight for urgency
- Weight for budget
- Weight for recency
- Weight for discovery quality
- Weight for intent confidence
- HOT threshold
- WARM threshold
- COLD threshold

### Required actions

- Create ICP
- Duplicate ICP
- Edit ICP
- Attach ICP to campaign
- Preview score effect
- Archive ICP

### Dependencies in current codebase

- `src/icp/`
- `src/scoring/`
- `frontend/app/(dashboard)/icp/`

### Success metric

- A non-technical user can configure who counts as a qualified lead.
- Score changes are understandable and visible.
- Campaigns can use different ICPs cleanly.

---

## 3. Prompt and Positioning Editor

### Why this matters

The prompts already exist in code, but the value to customers is not the prompt files themselves. The value is being able to control how CAE positions the business and speaks to prospects.

Without this, every deployment risks feeling generic.

### User stories

- As a founder, I want CAE to speak in my brand voice.
- As a marketer, I want to define our offer positioning so outreach reflects our actual value proposition.
- As an operator, I want to block weak or risky phrasing before it reaches prospects.

### What to build

- Company positioning editor
- Offer definition form
- Tone and voice controls
- CTA style controls
- Forbidden phrase rules
- Channel-specific prompt settings
- Prompt version history
- Message preview sandbox

### Required fields

- Company description
- Core offer
- Who the offer is for
- Main pain solved
- Main outcome promised
- Proof points / credibility
- Preferred tone
- Preferred CTA type
- Forbidden words or claims
- Compliance notes

### Required actions

- Edit positioning
- Save prompt configuration
- Preview output
- Compare versions
- Restore previous version

### Dependencies in current codebase

- `src/ai/prompts/`
- `src/ai/prompt-manager.service.ts`
- `src/pipeline/stages/personalizer.stage.ts`
- `src/pipeline/stages/outreach-generator.stage.ts`

### Success metric

- Each organization can control outreach style without engineering help.
- Message quality improves through business-side configuration.
- Prompt changes are versioned and reversible.

---

## 4. Feedback Loop and Outcome Tracking

### Why this matters

This is the most important long-term moat. Many tools can scrape and generate messages. Fewer tools can learn what actually converts for a specific business.

### User stories

- As a sales user, I want to mark outcomes so CAE learns from real results.
- As a manager, I want to know which lead traits correlate with replies and booked meetings.
- As a business owner, I want CAE to improve qualification over time instead of staying static.

### What to build

- Lead outcome update controls
- Conversion timeline view
- Performance breakdown by source
- Performance breakdown by campaign
- Performance breakdown by ICP
- Best-performing message pattern reporting
- Best-performing lead attribute reporting
- Score refinement recommendations

### Required lifecycle states

- Generated
- Approved
- Sent
- Replied
- Positive reply
- Negative reply
- Meeting booked
- Proposal sent
- Closed won
- Closed lost

### Required actions

- Update lead outcome
- Attribute result to campaign
- Attribute result to message
- View conversion funnel
- View winning signals
- View losing signals

### Dependencies in current codebase

- `src/analytics/`
- `src/icp/icp-learning.service.ts`
- `src/conversations/`
- `frontend/app/(dashboard)/analytics/`

### Success metric

- Users can move every lead through a measurable funnel.
- CAE can identify which signals and message patterns lead to revenue outcomes.
- Scoring and ICP tuning can be improved with real feedback data.

---

## 5. Reliability Console and Failed Job Recovery

### Why this matters

If CAE silently drops leads or fails mid-pipeline, businesses will not trust it. Reliability is not only an engineering concern here. It is a product requirement.

### User stories

- As an operator, I want to see where a lead failed in the pipeline.
- As a manager, I want to retry failed jobs so leads are not lost.
- As an admin, I want to know if an adapter or AI provider is failing before it affects campaigns.

### What to build

- Failed jobs panel
- Dead-letter queue view
- Retry controls
- Pipeline audit trail per lead
- Stage-level status view
- Error reason display
- Adapter health warnings
- AI provider failure warnings

### Required fields and indicators

- Lead ID
- Campaign
- Pipeline stage
- Failure reason
- First failure time
- Retry count
- Last retry time
- Current job status
- Source adapter

### Required actions

- Retry failed job
- Retry all for a stage
- Inspect lead audit trail
- Filter by failure type
- Filter by campaign
- Export failure logs

### Dependencies in current codebase

- `src/pipeline/`
- `src/jobs/`
- `src/health/`
- `frontend/app/(dashboard)/pipeline/`
- `frontend/app/(dashboard)/diagnostics/`

### Success metric

- No lead fails silently.
- Operators can identify and retry pipeline failures from the UI.
- Trust in automation increases because failures are visible and recoverable.

---

## P1 — Build Immediately After P0

## 6. Settings and Control Center

### What to build

- AI model selection by task
- token usage controls
- approval threshold controls
- score threshold controls
- adapter enable/disable controls
- data retention controls
- usage cap controls

### Why it matters

This gives organizations control over cost, quality, and operating mode.

### Dependencies

- `frontend/app/(dashboard)/settings/`
- `src/config/`
- `src/analytics/usage-metering.service.ts`

---

## 7. Conversation Workflow

### What to build

- inbox-style thread view
- reply assistant
- objection handling suggestions
- follow-up recommendations
- next-best-action recommendations

### Why it matters

CAE should not stop at first outreach. It should help convert active conversations into meetings.

### Dependencies

- `src/conversations/`
- `src/pipeline/stages/conversation-assistant.stage.ts`
- `frontend/app/(dashboard)/conversations/`

---

## 8. Integration and E2E Confidence Layer

### What to build

- pipeline integration tests
- campaign flow tests
- message approval flow tests
- failed-job recovery tests
- dashboard e2e tests

### Why it matters

This is a commercial trust feature. If the full flow breaks, the product is not sellable.

### Dependencies

- `test/`
- frontend Playwright or equivalent e2e setup

---

## Features Not To Prioritize Right Now

Do not prioritize more adapters before the above is done.

Current input coverage is already enough for the next phase:

- LinkedIn
- Google Maps
- CSV
- Webhook

The bottleneck is not lead source count.

The actual bottlenecks are:

- campaign control
- qualification tuning
- messaging control
- conversion learning
- reliability and trust

---

## Recommended Execution Order

1. Campaign Management UI
2. ICP Builder UI
3. Prompt and Positioning Editor
4. Feedback Loop and Outcome Tracking
5. Reliability Console and Failed Job Recovery
6. Settings and Control Center
7. Conversation Workflow
8. Integration and E2E Confidence Layer

---

## North Star Product Rule

CAE should prioritize features that make it better at one or more of the following:

- finding demand early
- qualifying leads correctly
- helping operators act fast
- learning from conversion outcomes
- building trust in automation

That is the shortest path to making CAE commercially defensible.
