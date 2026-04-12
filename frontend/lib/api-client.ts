/**
 * api-client.ts
 *
 * Domain-organised API call functions.
 * - URLs come from api-urls.ts (single source of truth).
 * - HTTP calls go through http.ts (axios, token injection, error normalisation).
 * - Every function returns the unwrapped payload (ApiResponse<T>.data).
 */

import { get, post, patch, del } from './http';
import { API_URLS } from './api-urls';

export { ApiError } from './http';

import type {
  Lead,
  LeadFilters,
  LeadStatus,
  LeadStats,
  Message,
  DashboardData,
  SourceBreakdown,
  TrendRow,
  FunnelStage,
  LoginResponse,
  RegisterResponse,
  ApiResponse,
  Campaign,
  CampaignPerformance,
  CreateCampaignDto,
  ICPProfile,
  ICPStats,
  CreateICPDto,
  Conversation,
  ReplySuggestions,
  HealthCheck,
} from '@/models';

function unwrap<T>(response: ApiResponse<T>): T {
  return response.data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login: (email: string, password: string) =>
    post<ApiResponse<LoginResponse>>(API_URLS.auth.login, { email, password }).then(unwrap),

  register: (payload: {
    email: string;
    password: string;
    name?: string;
    organizationName: string;
    organizationSlug: string;
  }) =>
    post<ApiResponse<RegisterResponse>>(API_URLS.auth.register, payload).then(unwrap),

  me: () =>
    get<ApiResponse<{ id: string; email: string; organizationId: string; role: string }>>(
      API_URLS.auth.me,
    ).then(unwrap),
};

// ── Leads ─────────────────────────────────────────────────────────────────────
export const leads = {
  list: (params?: Partial<LeadFilters> & { page?: number; skip?: number; limit?: number }) => {
    const normalizedParams =
      params?.skip !== undefined && params?.limit
        ? {
            ...params,
            page: Math.floor(params.skip / params.limit) + 1,
          }
        : params;
    const { skip: _skip, ...queryParams } = normalizedParams ?? {};

    return get<ApiResponse<{ data: Lead[]; meta: { total: number } }>>(
      API_URLS.leads.list(queryParams as Record<string, string | number | boolean | undefined | null>),
    )
      .then(unwrap)
      .then((payload) => ({ data: payload.data, total: payload.meta.total }));
  },

  get: (id: string) =>
    get<ApiResponse<Lead>>(API_URLS.leads.get(id)).then(unwrap),

  stats: () =>
    get<ApiResponse<LeadStats>>(API_URLS.leads.stats).then(unwrap),

  update: (id: string, body: Partial<Lead & { status: LeadStatus }>) =>
    patch<ApiResponse<Lead>>(API_URLS.leads.update(id), body).then(unwrap),

  updateStatus: (id: string, status: LeadStatus) =>
    patch<ApiResponse<Lead>>(API_URLS.leads.update(id), { status }).then(unwrap),

  bulkCreate: (leadsPayload: unknown[]) =>
    post<ApiResponse<{ created: number; duplicates: number; errors: number }>>(API_URLS.leads.bulk, leadsPayload).then(unwrap),

  delete: (id: string) =>
    del<void>(API_URLS.leads.delete(id)),

  optOut: (id: string) =>
    post<ApiResponse<Lead>>(API_URLS.leads.optOut(id)).then(unwrap),
};

// ── Messages ──────────────────────────────────────────────────────────────────
export const messages = {
  listPending: () =>
    get<ApiResponse<Message[]>>(API_URLS.messages.pendingApproval).then(unwrap),

  list: (params?: { leadId?: string; status?: string; campaignId?: string }) =>
    get<ApiResponse<Message[]>>(API_URLS.messages.list(params)).then(unwrap),

  approve: (id: string, body?: { editedBody?: string; editedSubject?: string; note?: string }) =>
    patch<ApiResponse<Message>>(API_URLS.messages.approve(id), body).then(unwrap),

  reject: (id: string, reason?: string) =>
    patch<ApiResponse<Message>>(API_URLS.messages.reject(id, reason)).then(unwrap),

  markSent: (id: string) =>
    patch<ApiResponse<Message>>(API_URLS.messages.markSent(id)).then(unwrap),
};

// ── Campaigns ─────────────────────────────────────────────────────────────────
export const campaigns = {
  list: (params?: { status?: string; isActive?: boolean }) =>
    get<ApiResponse<Campaign[]>>(API_URLS.campaigns.list(params)).then(unwrap),

  get: (id: string) =>
    get<ApiResponse<Campaign>>(API_URLS.campaigns.get(id)).then(unwrap),

  performance: (id: string) =>
    get<ApiResponse<CampaignPerformance>>(API_URLS.campaigns.performance(id)).then(unwrap),

  create: (body: CreateCampaignDto) =>
    post<ApiResponse<Campaign>>(API_URLS.campaigns.create, body).then(unwrap),

  update: (id: string, body: Partial<CreateCampaignDto>) =>
    patch<ApiResponse<Campaign>>(API_URLS.campaigns.update(id), body).then(unwrap),

  pause: (id: string) =>
    patch<ApiResponse<Campaign>>(API_URLS.campaigns.pause(id)).then(unwrap),

  resume: (id: string) =>
    patch<ApiResponse<Campaign>>(API_URLS.campaigns.resume(id)).then(unwrap),
};

// ── ICP ───────────────────────────────────────────────────────────────────────
export const icp = {
  list: () =>
    get<ApiResponse<ICPProfile[]>>(API_URLS.icp.list).then(unwrap),

  get: (id: string) =>
    get<ApiResponse<ICPProfile>>(API_URLS.icp.get(id)).then(unwrap),

  stats: (id: string) =>
    get<ApiResponse<ICPStats>>(API_URLS.icp.stats(id)).then(unwrap),

  create: (body: CreateICPDto) =>
    post<ApiResponse<ICPProfile>>(API_URLS.icp.create, body).then(unwrap),

  update: (id: string, body: Partial<CreateICPDto & { isActive: boolean }>) =>
    patch<ApiResponse<ICPProfile>>(API_URLS.icp.update(id), body).then(unwrap),
};

// ── Conversations ─────────────────────────────────────────────────────────────
export const conversations = {
  list: (params?: { leadId?: string; status?: string }) =>
    get<ApiResponse<Conversation[]>>(API_URLS.conversations.list(params)).then(unwrap),

  get: (id: string) =>
    get<ApiResponse<Conversation>>(API_URLS.conversations.get(id)).then(unwrap),

  replySuggestions: (id: string) =>
    get<ApiResponse<ReplySuggestions>>(
      API_URLS.conversations.replySuggestions(id),
    ).then(unwrap),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analytics = {
  dashboard: () =>
    get<ApiResponse<DashboardData>>(API_URLS.analytics.dashboard).then(unwrap),

  funnel: () =>
    get<ApiResponse<FunnelStage[]>>(API_URLS.analytics.funnel).then(unwrap),

  sources: () =>
    get<ApiResponse<SourceBreakdown[]>>(API_URLS.analytics.sources).then(unwrap),

  trend: (days = 14) =>
    get<ApiResponse<TrendRow[]>>(API_URLS.analytics.trend(days)).then(unwrap),
};

// ── Health ────────────────────────────────────────────────────────────────────
export const health = {
  full: () =>
    get<HealthCheck>(API_URLS.health.full),

  live: () =>
    get<{ status: string }>(API_URLS.health.live),

  ready: () =>
    get<{ status: string }>(API_URLS.health.ready),
};

// ── Organizations ─────────────────────────────────────────────────────────────

/** Shape returned by GET /api/v1/organizations/me/stats */
export interface OrgStats {
  organization: {
    id: string;
    name: string;
    tier: string;
    maxLeadsPerDay: number;
  };
  leads: {
    today: number;
    total: number;
    hot: number;
    remainingToday: number;
  };
  usage: {
    aiTokensUsed: string;
    aiCostCents: number;
    scrapesExecuted: number;
    leadsProcessed: number;
    apiCallsMade: number;
  } | null;
}

export const organizations = {
  me: () =>
    get<ApiResponse<{
      id: string;
      name: string;
      slug: string;
      tier: string;
      maxLeadsPerDay: number;
      maxAiTokensPerMonth: string;
      serviceOffering: string | null;
      createdAt: string;
      updatedAt: string;
    }>>(API_URLS.organizations.me).then(unwrap),

  stats: () =>
    get<ApiResponse<OrgStats>>(API_URLS.organizations.stats).then(unwrap),

  update: (body: Record<string, unknown>) =>
    patch<ApiResponse<unknown>>(API_URLS.organizations.update, body).then(unwrap),
};

// ── Compliance ────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/v1/compliance/retention-summary */
export interface RetentionSummary {
  totalLeads: number;
  optedOut: number;
  /** Leads whose dataExpiresAt is within the next 7 days */
  expiringSoon: number;
  retentionPolicyDays: number;
}

export const compliance = {
  retentionSummary: () =>
    get<ApiResponse<RetentionSummary>>(API_URLS.compliance.retentionSummary).then(unwrap),

  optOut: (leadId: string) =>
    post<ApiResponse<null>>(API_URLS.compliance.optOut(leadId)).then(unwrap),

  exportLead: (leadId: string) =>
    get<ApiResponse<unknown>>(API_URLS.compliance.export(leadId)).then(unwrap),

  deleteLead: (leadId: string) =>
    del<void>(API_URLS.compliance.deleteLead(leadId)),
};
