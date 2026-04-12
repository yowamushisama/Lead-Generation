# Lead Generation Engine — API Reference

**Base URL:** `http://localhost:3000`  
**Versioned prefix:** `/api/v1`  
**Interactive docs (Swagger UI):** `http://localhost:3000/api/docs` *(dev only)*

All authenticated endpoints require a `Bearer` JWT in the `Authorization` header.  
All responses follow the envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "optional human-readable note",
  "timestamp": "2026-04-12T10:00:00.000Z"
}
```

Error responses set `"success": false` and populate `"error"` instead of `"data"`.

---

## Auth — `/api/v1/auth`

### POST `/api/v1/auth/register`
Register a new user and organisation.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "Jane Doe",
  "organizationName": "Acme Corp",
  "organizationSlug": "acme-corp"
}
```

**Response `201`** — `ApiResponse<RegisterResponseDto>`
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "organizationId": "uuid",
    "email": "user@example.com",
    "accessToken": "eyJ..."
  }
}
```

**Errors:** `409` email or slug already exists.

---

### POST `/api/v1/auth/login`
Authenticate with email + password.

**Request body**
```json
{ "email": "user@example.com", "password": "securePassword123" }
```

**Response `200`** — `ApiResponse<LoginResponseDto>`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "tokenType": "Bearer",
    "expiresIn": 3600
  }
}
```

**Errors:** `401` invalid credentials.

---

### GET `/api/v1/auth/me` 🔐
Return the authenticated user's profile.

**Response `200`** — `ApiResponse<UserProfileDto>`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "admin",
    "organizationId": "uuid"
  }
}
```

---

### POST `/api/v1/auth/refresh` 🔐
Issue a fresh JWT using the current valid token.

**Response `200`** — `ApiResponse<LoginResponseDto>` *(same shape as login)*

---

## Leads — `/api/v1/leads` 🔐

### GET `/api/v1/leads`
List leads with optional filtering and pagination.

**Query params**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by lead status (e.g. `NEW`, `REPLIED`, `CONVERTED`) |
| `tier` | string | Filter by tier (`HOT`, `WARM`, `COLD`) |
| `source` | string | Filter by acquisition source |
| `campaignId` | uuid | Filter to a specific campaign |
| `minScore` | number | Minimum lead score |
| `maxScore` | number | Maximum lead score |
| `industry` | string | Partial match on industry |
| `location` | string | Partial match on location |
| `search` | string | Full-text search across name, company, email |
| `page` | number | Page number, 1-based (default: 1) |
| `limit` | number | Page size, max 100 (default: 20) |
| `sortBy` | string | Field to sort by (default: `createdAt`) |
| `sortOrder` | `asc`\|`desc` | Sort direction (default: `desc`) |

**Response `200`** — `ApiResponse<PaginatedResult<Lead>>`

```json
{
  "success": true,
  "data": {
    "data": [ { "id": "uuid", "name": "Jane Doe", "..." } ],
    "meta": {
      "total": 1200,
      "page": 1,
      "limit": 20,
      "totalPages": 60,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}

---

### GET `/api/v1/leads/stats`
Organisation-level lead statistics.

**Response `200`** — `ApiResponse<LeadStats>`
```json
{
  "success": true,
  "data": {
    "total": 1200,
    "averageScore": 42.7,
    "byTier": { "HOT": 48, "WARM": 210, "COLD": 942 },
    "byStatus": { "NEW": 600, "REPLIED": 120, "CONVERTED": 80, "OPT_OUT": 5 },
    "bySource": { "linkedin": 500, "google_maps": 400, "csv": 300 }
  }
}
```

---

### GET `/api/v1/leads/:id`
Get a single lead by UUID.

**Response `200`** — `ApiResponse<Lead>`  
**Errors:** `404`

---

### POST `/api/v1/leads`
Create a new lead manually.

**Request body** — `CreateLeadDto`  
**Response `201`** — `ApiResponse<Lead>`  
**Errors:** `409` duplicate (same `externalId` + `source` + `organizationId`)

---

### PATCH `/api/v1/leads/:id`
Partially update a lead.

**Request body** — `UpdateLeadDto` (all fields optional)  
**Response `200`** — `ApiResponse<Lead>`

---

### DELETE `/api/v1/leads/:id`
Delete a lead record.

**Response `204`** — no body  
**Errors:** `404`

---

### POST `/api/v1/leads/:id/opt-out`
Mark a lead as opted-out (GDPR / CAN-SPAM). Sets status to `OPT_OUT`.

**Response `200`** — `ApiResponse<Lead>`

---

### POST `/api/v1/leads/bulk`
Bulk-create leads from an array. Limited to 500 per request.

**Request body** — bare `CreateLeadDto[]` array (no wrapper object)
```json
[
  { "name": "Jane Doe", "source": "linkedin", "..." },
  { "name": "John Smith", "source": "csv", "..." }
]
```

**Response `201`** — `ApiResponse<{ created: number; duplicates: number; errors: number }>`
```json
{
  "success": true,
  "data": { "created": 48, "duplicates": 3, "errors": 0 }
}
```

---

## Campaigns — `/api/v1/campaigns` 🔐

### GET `/api/v1/campaigns`
List all campaigns. Each item includes live outreach metrics computed from the database.

**Query params**

| Param | Type | Description |
|---|---|---|
| `status` | string | `ACTIVE` or `PAUSED` |
| `isActive` | boolean | Active/inactive filter |

**Response `200`** — `ApiResponse<CampaignResponseDto[]>`
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "name": "Q3 SaaS Founders Outreach",
    "status": "ACTIVE",
    "isActive": true,
    "leadsGenerated": 340,
    "messagesSent": 280,
    "replies": 42,
    "conversions": 18,
    "meetings": 0,
    "createdAt": "2026-01-15T09:00:00.000Z",
    "updatedAt": "2026-04-10T14:30:00.000Z"
  }]
}
```

---

### POST `/api/v1/campaigns`
Create a new campaign.

**Request body** — `CreateCampaignDto`
```json
{
  "name": "Q3 SaaS Founders Outreach",
  "description": "Targeting Series-A SaaS founders in the US",
  "icpProfileId": "uuid",
  "maxLeadsPerDay": 50,
  "targetSources": ["linkedin", "google_maps"],
  "targetIndustry": "SaaS",
  "targetLocation": "United States",
  "minIntentConfidence": 0.7,
  "autoApproveWarm": false
}
```

**Response `201`** — `ApiResponse<CampaignResponseDto>`

---

### GET `/api/v1/campaigns/:id`
Get a campaign by UUID.

**Response `200`** — `ApiResponse<CampaignResponseDto>`  
**Errors:** `404`

---

### GET `/api/v1/campaigns/:id/performance`
Detailed per-status breakdowns and KPIs for a campaign.

**Response `200`** — `ApiResponse<CampaignPerformanceResponseDto>`
```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "leadsByStatus": { "NEW": 120, "REPLIED": 42, "CONVERTED": 18 },
    "messagesByStatus": { "SENT": 280, "PENDING_APPROVAL": 5 },
    "metrics": {
      "totalLeads": 340,
      "messagesSent": 280,
      "replyRate": 0.15,
      "conversionRate": 0.053
    }
  }
}
```

---

### PATCH `/api/v1/campaigns/:id`
Update campaign fields (`name`, `description`, `icpProfileId`).

**Response `200`** — `ApiResponse<CampaignResponseDto>`

---

### PATCH `/api/v1/campaigns/:id/pause`
Pause a campaign. Sets `status = PAUSED`, `isActive = false`.

**Response `200`** — `ApiResponse<CampaignResponseDto>`

---

### PATCH `/api/v1/campaigns/:id/resume`
Resume a paused campaign. Sets `status = ACTIVE`, `isActive = true`.

**Response `200`** — `ApiResponse<CampaignResponseDto>`

---

## Messages — `/api/v1/messages` 🔐

### GET `/api/v1/messages`
List messages with optional filters.

**Query params**

| Param | Type | Description |
|---|---|---|
| `leadId` | uuid | Filter by lead |
| `status` | string | e.g. `PENDING_APPROVAL`, `SENT` |
| `campaignId` | uuid | Filter by campaign |

**Response `200`** — `ApiResponse<MessageResponseDto[]>`

---

### GET `/api/v1/messages/pending-approval`
Messages awaiting human review before sending.

**Response `200`** — `ApiResponse<MessageResponseDto[]>`

---

### GET `/api/v1/messages/:id`
Get a single message.

**Response `200`** — `ApiResponse<MessageResponseDto>`  
**Errors:** `404`

---

### POST `/api/v1/messages`
Create a message draft.

**Request body** — `CreateMessageDto`  
**Response `201`** — `ApiResponse<MessageResponseDto>`

---

### PATCH `/api/v1/messages/:id/approve`
Approve a message (optionally with edits).

**Request body** *(optional)*
```json
{
  "editedBody": "Hi Jane, …",
  "editedSubject": "Quick question",
  "note": "Adjusted tone slightly"
}
```

**Response `200`** — `ApiResponse<MessageResponseDto>`

---

### PATCH `/api/v1/messages/:id/reject`
Reject a message.

**Query params:** `reason` (optional string)  
**Response `200`** — `ApiResponse<MessageResponseDto>`

---

### PATCH `/api/v1/messages/:id/sent`
Mark a message as sent after the adapter delivers it.

**Response `200`** — `ApiResponse<MessageResponseDto>`

---

## Conversations — `/api/v1/conversations` 🔐

### GET `/api/v1/conversations`
List conversations. Each includes a lead summary: `name`, `role`, `company`, `score`, `tier`.

**Query params**

| Param | Type | Description |
|---|---|---|
| `leadId` | uuid | Filter by lead |
| `status` | string | `ACTIVE` or `CLOSED` |

**Response `200`** — `ApiResponse<ConversationResponseDto[]>`

---

### POST `/api/v1/conversations`
Start a new conversation thread for a lead.

**Request body**
```json
{ "leadId": "uuid", "channel": "linkedin-dm" }
```

**Response `201`** — `ApiResponse<ConversationResponseDto>`  
**Errors:** `404` lead not found.

---

### GET `/api/v1/conversations/:id`
Get a single conversation with full message history.

**Response `200`** — `ApiResponse<ConversationResponseDto>`  
**Errors:** `404`

---

### GET `/api/v1/conversations/:id/reply-suggestions`
AI-generated reply suggestions for the latest incoming message.

**Response `200`** — `ApiResponse<ReplySuggestionsResponseDto>`
```json
{
  "success": true,
  "data": {
    "objectionDetected": true,
    "objectionType": "pricing",
    "deterministicSuggestion": "I understand budget is a concern…",
    "aiSuggestions": ["Option A…", "Option B…"],
    "recommended": "Address the pricing concern directly",
    "analysis": "The lead expressed concern about…"
  }
}
```

---

### POST `/api/v1/conversations/:id/messages`
Append a message to the thread.

**Request body**
```json
{ "content": "Hi, just following up…", "fromUs": true }
```

`fromUs: true` = outbound (sent by us); `fromUs: false` = inbound (lead reply).

**Response `201`** — `ApiResponse<ConversationResponseDto>`

---

## ICP Profiles — `/api/v1/icp` 🔐

### GET `/api/v1/icp`
List all ICP profiles for the tenant.

**Response `200`** — `ApiResponse<ICPProfileResponseDto[]>`

---

### POST `/api/v1/icp`
Create a new ICP profile.

**Request body**
```json
{
  "name": "B2B SaaS Founders",
  "config": {
    "targetRoles": ["CEO", "CTO", "Founder"],
    "targetIndustries": ["SaaS", "Fintech"],
    "targetStages": ["Series-A", "Seed"],
    "targetLocations": ["US", "Canada"],
    "buyerSignals": ["hiring", "funding"],
    "urgencySignals": ["scaling", "pain point"],
    "budgetSignals": ["raised", "profitable"]
  }
}
```

**Response `201`** — `ApiResponse<ICPProfileResponseDto>`

---

### GET `/api/v1/icp/:id`
Get a single ICP profile.

**Response `200`** — `ApiResponse<ICPProfileResponseDto>`  
**Errors:** `404`

---

### GET `/api/v1/icp/:id/stats`
Conversion metrics and learned signal weights for a profile.

**Response `200`** — `ApiResponse<ICPStatsResponseDto>`
```json
{
  "success": true,
  "data": {
    "profile": { "id": "uuid", "name": "B2B SaaS Founders", "version": 3, ... },
    "stats": {
      "totalLeads": 1200,
      "convertedLeads": 108,
      "conversionRate": 0.09,
      "version": 3,
      "learnedWeightsCount": 14
    }
  }
}
```

---

### PATCH `/api/v1/icp/:id`
Update an ICP profile. Updating `config` auto-increments `version`.

**Request body** — partial `{ name?, config?, isActive? }`  
**Response `200`** — `ApiResponse<ICPProfileResponseDto>`

---

## Analytics — `/api/v1/analytics` 🔐

### GET `/api/v1/analytics/dashboard`
30-day overview: lead counts by tier/status, outreach KPIs, AI usage.

**Response `200`** — `ApiResponse<DashboardResponseDto>`
```json
{
  "success": true,
  "data": {
    "period": "30 days",
    "leads": {
      "total": 340, "hot": 48, "warm": 150, "cold": 142,
      "byStatus": { "NEW": 80, "REPLIED": 42, "CONVERTED": 18 },
      "byTier":   { "HOT": 48, "WARM": 150, "COLD": 142 }
    },
    "outreach": {
      "messagesSent": 280,
      "replyRate": 0.15,
      "conversionRate": 0.053,
      "byStatus": { "SENT": 270, "PENDING_APPROVAL": 10 }
    },
    "usage": {
      "aiTokensUsed": "45200",
      "aiCostCents": 182,
      "leadsProcessed": 340,
      "scrapesExecuted": 12,
      "apiCallsMade": 540
    }
  }
}
```

---

### GET `/api/v1/analytics/funnel`
Lead counts at each pipeline stage.

**Response `200`** — `ApiResponse<FunnelStageDto[]>`
```json
{
  "success": true,
  "data": [
    { "stage": "NEW",              "count": 340, "dropOff": 0 },
    { "stage": "ENRICHED",         "count": 290, "dropOff": 50 },
    { "stage": "SCORED",           "count": 280, "dropOff": 10 },
    { "stage": "PERSONALIZED",     "count": 275, "dropOff": 5 },
    { "stage": "MESSAGE_DRAFTED",  "count": 270, "dropOff": 5 },
    { "stage": "MESSAGE_APPROVED", "count": 260, "dropOff": 10 },
    { "stage": "OUTREACH_SENT",    "count": 250, "dropOff": 10 },
    { "stage": "REPLIED",          "count": 42,  "dropOff": 208 },
    { "stage": "MEETING_BOOKED",   "count": 20,  "dropOff": 22 },
    { "stage": "CONVERTED",        "count": 18,  "dropOff": 2 }
  ]
}
```

---

### GET `/api/v1/analytics/sources`
Lead counts grouped by acquisition source.

**Response `200`** — `ApiResponse<SourceBreakdownDto[]>`

---

### GET `/api/v1/analytics/trend`
Daily lead and token usage over a look-back window.

**Query params:** `days` (number, default `14`)

**Response `200`** — `ApiResponse<TrendRowDto[]>`
```json
{
  "success": true,
  "data": [
    { "date": "2026-03-30T00:00:00.000Z", "leadsProcessed": 24, "aiTokensUsed": "3400" },
    { "date": "2026-03-31T00:00:00.000Z", "leadsProcessed": 31, "aiTokensUsed": "4100" }
  ]
}
```

> `aiTokensUsed` is serialised as a string because Prisma returns it as `BigInt`.

---

## Compliance — `/api/v1/compliance` 🔐

### GET `/api/v1/compliance/retention-summary`
GDPR data retention overview.

**Response `200`** — `ApiResponse<RetentionSummaryDto>`
```json
{
  "success": true,
  "data": {
    "totalLeads": 1200,
    "optedOut": 5,
    "expiringSoon": 8,
    "retentionPolicyDays": 90
  }
}
```

> `expiringSoon` = leads whose `dataExpiresAt` falls within the **next 7 days**.

---

### POST `/api/v1/compliance/opt-out/:leadId`
Process a GDPR opt-out. Marks the lead as `OPT_OUT`, cancels all pending messages, sets a 30-day data expiry. Idempotent.

**Response `200`** — `ApiResponse<null>` with `"message": "Opt-out processed"`  
**Errors:** `404`

---

### GET `/api/v1/compliance/export/:leadId`
Export all stored data for a lead (GDPR right of access).

**Response `200`** — `ApiResponse<LeadExportResponseDto>`
```json
{
  "success": true,
  "data": {
    "exportedAt": "2026-04-12T10:00:00.000Z",
    "lead": {
      "id": "uuid", "name": "Jane Smith", "email": "jane@example.com",
      "source": "linkedin", "status": "REPLIED", "score": 78,
      "messages": [ ... ],
      "conversations": [ ... ]
    }
  }
}
```

---

### DELETE `/api/v1/compliance/leads/:leadId`
Permanently delete a lead and all associated data (GDPR right to erasure). **Irreversible.**

**Response `200`** — `ApiResponse<null>` with `"message": "Lead data deleted"`  
**Errors:** `404`

---

## Organizations — `/api/v1/organizations` 🔐

### GET `/api/v1/organizations/me`
Return the authenticated tenant's organisation profile.

**Response `200`** — `ApiResponse<OrganizationResponseDto>`

---

### PATCH `/api/v1/organizations/me` *(role: admin)*
Update the current organisation's settings.

**Request body** — `UpdateOrganizationDto` (partial)  
**Response `200`** — `ApiResponse<OrganizationResponseDto>`

---

### GET `/api/v1/organizations/me/stats`
Today's usage figures and lead counts for the organisation.

**Response `200`** — `ApiResponse<OrgStatsResponseDto>`
```json
{
  "success": true,
  "data": {
    "organization": { "id": "uuid", "name": "Acme Corp", "tier": "starter", "maxLeadsPerDay": 50 },
    "leads": { "today": 12, "total": 1200, "hot": 48, "remainingToday": 38 },
    "usage": {
      "aiTokensUsed": "12345",
      "aiCostCents": 49,
      "scrapesExecuted": 3,
      "leadsProcessed": 12,
      "apiCallsMade": 180
    }
  }
}
```

> `usage` is `null` if no `UsageRecord` exists for today.

---

### GET `/api/v1/organizations/:id` *(role: superadmin)*
Get any organisation by UUID.

### POST `/api/v1/organizations` *(role: superadmin)*
Create a new organisation.

### PATCH `/api/v1/organizations/:id` *(role: superadmin)*
Update any organisation by UUID.

---

## Health — `/api/v1/health`

Health endpoints are **unauthenticated**.

### GET `/api/v1/health`
Full system health check (Terminus). Returns per-subsystem indicators.

**Response `200`**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis":    { "status": "up" },
    "queues":   { "status": "up" }
  },
  "error":   {},
  "details": {
    "database": { "status": "up" },
    "redis":    { "status": "up" },
    "queues":   { "status": "up" }
  }
}
```

**Response `503`** when any subsystem is unhealthy (`status: "error"`).

> This response is **not** wrapped in the standard `ApiResponseDto` envelope — it is the raw Terminus format.

---

### GET `/api/v1/health/live`
Liveness probe — confirms the process is running.

**Response `200`**
```json
{ "status": "ok", "timestamp": "2026-04-12T10:00:00.000Z" }
```

---

### GET `/api/v1/health/ready`
Readiness probe — confirms the app can serve traffic (checks database + Redis).

**Response `200` / `503`** — same Terminus shape as `/health`.

---

## Error Format

All non-2xx responses from guarded endpoints return:

```json
{
  "success": false,
  "error": "Descriptive error message",
  "timestamp": "2026-04-12T10:00:00.000Z"
}
```

Common status codes:

| Code | Meaning |
|---|---|
| `400` | Validation error (class-validator rejected the body) |
| `401` | Missing or expired JWT |
| `403` | Insufficient role |
| `404` | Resource not found |
| `409` | Conflict (duplicate record) |
| `500` | Unhandled server error |

---

## Frontend Service Architecture

The frontend splits API concerns across three files:

| File | Responsibility |
|---|---|
| `frontend/lib/api-urls.ts` | Single source of truth for every endpoint URL string |
| `frontend/lib/http.ts` | Axios instance, JWT injection interceptor, `ApiError` normalisation, typed `get/post/patch/del` helpers |
| `frontend/lib/api-client.ts` | Domain-grouped functions (`auth`, `leads`, `campaigns`, …) — calls `http.*` with URLs from `api-urls.ts`, unwraps `ApiResponse<T>.data` |

Usage in components:

```ts
import { campaigns } from '@/lib/api-client';

// Returns Campaign[] (data already unwrapped)
const list = await campaigns.list({ status: 'ACTIVE' });
```
