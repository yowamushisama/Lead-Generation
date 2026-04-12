/**
 * http.ts
 *
 * Axios-based HTTP service.
 * - Injects the JWT access token from the auth_token cookie on every request.
 * - Normalises error responses into ApiError so callers can catch them uniformly.
 * - Provides typed get / post / patch / del helpers used by api-client.ts.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ── Token helper ─────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Axios instance ────────────────────────────────────────────────────────────

const client: AxiosInstance = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT before every request
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise errors into ApiError
client.interceptors.response.use(
  (response) => response,
  (err: AxiosError) => {
    const status = err.response?.status ?? 0;
    const body = err.response?.data;
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as Record<string, unknown>).message)
        : err.message;
    return Promise.reject(new ApiError(status, message));
  },
);

// ── Typed HTTP methods ────────────────────────────────────────────────────────

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await client.get<T>(url, { params });
  return response.data;
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const response = await client.post<T>(url, data);
  return response.data;
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const response = await client.patch<T>(url, data);
  return response.data;
}

export async function del<T = void>(url: string): Promise<T> {
  const response = await client.delete<T>(url);
  return response.data;
}
