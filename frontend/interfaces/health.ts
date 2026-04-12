export type HealthStatus = 'ok' | 'error' | 'degraded';

/** Per-subsystem indicator from NestJS Terminus */
export interface HealthIndicator {
  /** 'up' means healthy, 'down' means failing */
  status: 'up' | 'down';
  [key: string]: unknown;
}

/**
 * Shape returned by NestJS Terminus (@nestjs/terminus).
 *
 * Top-level `status` is the overall result ('ok' | 'error' | 'shutting_down').
 * Individual subsystem results live under `info` (passing) and `error` (failing),
 * and are mirrored in `details` regardless of pass/fail.
 *
 * Example:
 * {
 *   "status": "ok",
 *   "info":    { "database": { "status": "up" }, "redis": { "status": "up" } },
 *   "error":   {},
 *   "details": { "database": { "status": "up" }, "redis": { "status": "up" } }
 * }
 */
export interface HealthCheck {
  status: HealthStatus | string;
  /** Passing subsystem indicators (key = indicator name, e.g. "database") */
  info?: Record<string, HealthIndicator>;
  /** Failing subsystem indicators */
  error?: Record<string, HealthIndicator>;
  /** All indicators regardless of status — use this for display */
  details?: Record<string, HealthIndicator>;
  timestamp?: string;
}

/**
 * Utility: derive a display status ('ok' | 'error') from a Terminus HealthIndicator.
 * Maps 'up' → 'ok' and anything else → 'error'.
 */
export function indicatorStatus(check: HealthCheck | undefined, name: string): 'ok' | 'error' | undefined {
  if (!check) return undefined;
  const indicator = check.info?.[name] ?? check.details?.[name];
  if (!indicator) return undefined;
  return indicator.status === 'up' ? 'ok' : 'error';
}
