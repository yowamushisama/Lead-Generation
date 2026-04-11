import type {
  Lead,
  LeadStatus,
  Message,
  DashboardData,
  SourceBreakdown,
  TrendRow,
  LoginResponse,
  RegisterResponse,
  ApiResponse,
} from '@/models';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
// Responses are wrapped by ApiResponseDto.success() → unwrap .data before returning.

export const auth = {
  login: (email: string, password: string) =>
    request<ApiResponse<LoginResponse>>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((r) => r.data),

  register: (payload: {
    email: string;
    password: string;
    name?: string;
    organizationName: string;
    organizationSlug: string;
  }) =>
    request<ApiResponse<RegisterResponse>>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((r) => r.data),
};

// ── Leads ────────────────────────────────────────────────────────────────────
// Responses are wrapped by ApiResponseDto.success(paginate(...)) → unwrap and normalise.

export const leads = {
  list: (params?: { status?: LeadStatus; limit?: number; offset?: number }) => {
    const qs = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return request<ApiResponse<{ data: Lead[]; meta: { total: number } }>>(
      `/api/v1/leads${qs}`,
    ).then((r) => ({ data: r.data.data, total: r.data.meta.total }));
  },

  updateStatus: (id: string, status: LeadStatus) =>
    request<ApiResponse<Lead>>(`/api/v1/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).then((r) => r.data),
};

// ── Messages ─────────────────────────────────────────────────────────────────
// Responses are returned directly (no ApiResponseDto wrapper).

export const messages = {
  listPending: () =>
    request<Message[]>('/api/v1/messages/pending-approval'),

  approve: (id: string) =>
    request<Message>(`/api/v1/messages/${id}/approve`, { method: 'PATCH' }),

  reject: (id: string, reason?: string) => {
    const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return request<Message>(`/api/v1/messages/${id}/reject${qs}`, { method: 'PATCH' });
  },
};

// ── Analytics ────────────────────────────────────────────────────────────────
// Responses are returned directly (no ApiResponseDto wrapper).

export const analytics = {
  dashboard: () =>
    request<DashboardData>('/api/v1/analytics/dashboard'),

  sources: () =>
    request<SourceBreakdown[]>('/api/v1/analytics/sources'),

  trend: (days = 14) =>
    request<TrendRow[]>(`/api/v1/analytics/trend?days=${days}`),
};
