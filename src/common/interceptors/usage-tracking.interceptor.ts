import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TenantContext } from '../interfaces/tenant-context.interface';

interface RequestWithTenant {
  tenantContext?: TenantContext;
  correlationId?: string;
  method: string;
  url: string;
}

export interface UsageEvent {
  organizationId: string;
  userId: string;
  eventType: 'api_call';
  method: string;
  url: string;
  timestamp: Date;
  correlationId?: string;
}

@Injectable()
export class UsageTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UsageTrackingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const tenantContext = request.tenantContext;

    if (!tenantContext) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const usageEvent: UsageEvent = {
            organizationId: tenantContext.organizationId,
            userId: tenantContext.userId,
            eventType: 'api_call',
            method: request.method,
            url: request.url,
            timestamp: new Date(),
            correlationId: request.correlationId,
          };

          this.logger.debug({
            message: 'Usage event tracked',
            ...usageEvent,
            module: 'UsageTracking',
          });
        },
      }),
    );
  }
}
