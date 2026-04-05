import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { TenantContext } from '../interfaces/tenant-context.interface';

interface RequestWithTenant {
  method: string;
  url: string;
  tenantContext?: TenantContext;
  correlationId?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ?? uuidv4();

    request.correlationId = correlationId;

    const { method, url } = request;
    const organizationId = request.tenantContext?.organizationId ?? 'unknown';
    const startTime = Date.now();

    this.logger.log({
      message: `Incoming request: ${method} ${url}`,
      correlationId,
      organizationId,
      module: 'HTTP',
      method,
      url,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log({
            message: `Request completed: ${method} ${url} - ${duration}ms`,
            correlationId,
            organizationId,
            module: 'HTTP',
            method,
            url,
            duration,
          });
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            message: `Request failed: ${method} ${url} - ${duration}ms`,
            correlationId,
            organizationId,
            module: 'HTTP',
            method,
            url,
            duration,
            error: error.message,
          });
        },
      }),
    );
  }
}
