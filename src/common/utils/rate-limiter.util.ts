import { Injectable, Logger } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

@Injectable()
export class RateLimiterUtil {
  private readonly logger = new Logger(RateLimiterUtil.name);
  private readonly store = new Map<string, RateLimitEntry>();

  isAllowed(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= config.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= config.maxRequests) {
      this.logger.warn({
        message: `Rate limit exceeded for key: ${key}`,
        module: 'RateLimiter',
        key,
        count: entry.count,
        maxRequests: config.maxRequests,
      });
      return false;
    }

    entry.count += 1;
    return true;
  }

  getRemainingRequests(key: string, config: RateLimitConfig): number {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= config.windowMs) {
      return config.maxRequests;
    }

    return Math.max(0, config.maxRequests - entry.count);
  }

  getResetTime(key: string, config: RateLimitConfig): number {
    const entry = this.store.get(key);
    if (!entry) return Date.now() + config.windowMs;
    return entry.windowStart + config.windowMs;
  }

  clearExpired(windowMs: number): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart >= windowMs) {
        this.store.delete(key);
      }
    }
  }

  async withRateLimit<T>(
    key: string,
    config: RateLimitConfig,
    fn: () => Promise<T>,
    delayMs?: number,
  ): Promise<T> {
    if (!this.isAllowed(key, config)) {
      const resetIn = this.getResetTime(key, config) - Date.now();
      await new Promise<void>((resolve) => setTimeout(resolve, resetIn));
    }

    if (delayMs) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }

    return fn();
  }
}
