/**
 * api-urls.ts
 *
 * Single source of truth for every backend endpoint URL.
 * All paths follow the pattern /api/v1/<resource>[/<sub>] which matches:
 *   setGlobalPrefix('api') + enableVersioning({ defaultVersion: '1' }) in main.ts
 *
 * No HTTP logic lives here — this file only builds strings.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const V1 = `${BASE}/api/v1`;

function qs(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== 'all',
  );
  return filtered.length ? '?' + new URLSearchParams(filtered.map(([k, v]) => [k, String(v)])).toString() : '';
}

export const API_URLS = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    login:    `${V1}/auth/login`,
    register: `${V1}/auth/register`,
    me:       `${V1}/auth/me`,
    refresh:  `${V1}/auth/refresh`,
  },

  // ── Leads ───────────────────────────────────────────────────────────────────
  leads: {
    list:       (params?: Record<string, string | number | boolean | undefined | null>) => `${V1}/leads${qs(params)}`,
    get:        (id: string) => `${V1}/leads/${id}`,
    stats:      `${V1}/leads/stats`,
    update:     (id: string) => `${V1}/leads/${id}`,
    delete:     (id: string) => `${V1}/leads/${id}`,
    optOut:     (id: string) => `${V1}/leads/${id}/opt-out`,
    bulk:       `${V1}/leads/bulk`,
  },

  // ── Messages ────────────────────────────────────────────────────────────────
  messages: {
    list:            (params?: Record<string, string | undefined>) => `${V1}/messages${qs(params)}`,
    pendingApproval: `${V1}/messages/pending-approval`,
    get:             (id: string) => `${V1}/messages/${id}`,
    approve:         (id: string) => `${V1}/messages/${id}/approve`,
    reject:          (id: string, reason?: string) => `${V1}/messages/${id}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`,
    markSent:        (id: string) => `${V1}/messages/${id}/sent`,
  },

  // ── Campaigns ───────────────────────────────────────────────────────────────
  campaigns: {
    list:        (params?: Record<string, string | boolean | undefined>) => `${V1}/campaigns${qs(params)}`,
    get:         (id: string) => `${V1}/campaigns/${id}`,
    performance: (id: string) => `${V1}/campaigns/${id}/performance`,
    create:      `${V1}/campaigns`,
    update:      (id: string) => `${V1}/campaigns/${id}`,
    pause:       (id: string) => `${V1}/campaigns/${id}/pause`,
    resume:      (id: string) => `${V1}/campaigns/${id}/resume`,
  },

  // ── ICP ─────────────────────────────────────────────────────────────────────
  icp: {
    list:   `${V1}/icp`,
    get:    (id: string) => `${V1}/icp/${id}`,
    stats:  (id: string) => `${V1}/icp/${id}/stats`,
    create: `${V1}/icp`,
    update: (id: string) => `${V1}/icp/${id}`,
  },

  // ── Conversations ────────────────────────────────────────────────────────────
  conversations: {
    list:            (params?: Record<string, string | undefined>) => `${V1}/conversations${qs(params)}`,
    get:             (id: string) => `${V1}/conversations/${id}`,
    replySuggestions:(id: string) => `${V1}/conversations/${id}/reply-suggestions`,
    create:          `${V1}/conversations`,
    addMessage:      (id: string) => `${V1}/conversations/${id}/messages`,
  },

  // ── Analytics ────────────────────────────────────────────────────────────────
  analytics: {
    dashboard: `${V1}/analytics/dashboard`,
    funnel:    `${V1}/analytics/funnel`,
    sources:   `${V1}/analytics/sources`,
    trend:     (days?: number) => `${V1}/analytics/trend${days ? `?days=${days}` : ''}`,
  },

  // ── Health ───────────────────────────────────────────────────────────────────
  health: {
    full:  `${V1}/health`,
    live:  `${V1}/health/live`,
    ready: `${V1}/health/ready`,
  },

  // ── Organizations ─────────────────────────────────────────────────────────────
  organizations: {
    me:     `${V1}/organizations/me`,
    stats:  `${V1}/organizations/me/stats`,
    update: `${V1}/organizations/me`,
    getById:(id: string) => `${V1}/organizations/${id}`,
  },

  // ── Compliance ───────────────────────────────────────────────────────────────
  compliance: {
    retentionSummary: `${V1}/compliance/retention-summary`,
    optOut:           (leadId: string) => `${V1}/compliance/opt-out/${leadId}`,
    export:           (leadId: string) => `${V1}/compliance/export/${leadId}`,
    deleteLead:       (leadId: string) => `${V1}/compliance/leads/${leadId}`,
  },
} as const;
