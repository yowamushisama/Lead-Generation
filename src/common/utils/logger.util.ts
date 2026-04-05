import { LoggerService, Injectable, Scope } from '@nestjs/common';

export interface LogContext {
  correlationId?: string;
  organizationId?: string;
  module?: string;
  userId?: string;
  [key: string]: unknown;
}

type LogPayload = string | (LogContext & { message: string });

function formatLogEntry(message: LogPayload, context?: string): string {
  if (typeof message === 'string') {
    const entry = {
      timestamp: new Date().toISOString(),
      context: context ?? 'App',
      message,
    };
    return JSON.stringify(entry);
  }

  const { message: msg, ...rest } = message;
  const entry = {
    timestamp: new Date().toISOString(),
    context: context ?? rest['module'] ?? 'App',
    message: msg,
    ...rest,
  };
  return JSON.stringify(entry);
}

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: LogPayload, context?: string): void {
    const ctx = context ?? this.context;
    process.stdout.write(
      `[LOG] ${formatLogEntry(message, ctx)}\n`,
    );
  }

  error(message: LogPayload, trace?: string, context?: string): void {
    const ctx = context ?? this.context;
    const formatted = formatLogEntry(message, ctx);
    process.stderr.write(`[ERROR] ${formatted}${trace ? `\n${trace}` : ''}\n`);
  }

  warn(message: LogPayload, context?: string): void {
    const ctx = context ?? this.context;
    process.stdout.write(`[WARN] ${formatLogEntry(message, ctx)}\n`);
  }

  debug(message: LogPayload, context?: string): void {
    if (process.env['NODE_ENV'] === 'production') return;
    const ctx = context ?? this.context;
    process.stdout.write(`[DEBUG] ${formatLogEntry(message, ctx)}\n`);
  }

  verbose(message: LogPayload, context?: string): void {
    if (process.env['NODE_ENV'] === 'production') return;
    const ctx = context ?? this.context;
    process.stdout.write(`[VERBOSE] ${formatLogEntry(message, ctx)}\n`);
  }
}
