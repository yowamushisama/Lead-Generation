export interface RetryOptions {
  maxAttempts: number;
  baseMs: number;
  jitter: number;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= opts.maxAttempts) throw err;
      const base = opts.baseMs * Math.pow(4, attempt - 1);
      const jittered = base * (1 + (Math.random() * 2 - 1) * opts.jitter);
      await new Promise((res) => setTimeout(res, Math.round(jittered)));
    }
  }
}

export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes('net::ERR_') ||
    msg.includes('TimeoutError') ||
    msg.includes('Timeout') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ECONNREFUSED')
  );
}
