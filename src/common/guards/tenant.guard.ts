import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantContext } from '../interfaces/tenant-context.interface';
import { TenantMode } from '../enums/tenant-mode.enum';

interface JwtPayload {
  sub: string;
  email: string;
  organizationId?: string;
  role?: string;
}

interface AuthenticatedRequest {
  user?: JwtPayload;
  headers: Record<string, string | string[] | undefined>;
  tenantContext: TenantContext;
}

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly tenantMode: TenantMode;
  private readonly defaultOrgId: string;

  constructor(private readonly configService: ConfigService) {
    this.tenantMode =
      (this.configService.get<string>('TENANT_MODE') as TenantMode) ?? TenantMode.SINGLE;
    this.defaultOrgId = this.configService.get<string>('DEFAULT_ORGANIZATION_ID') ?? 'default';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const tenantContext = this.buildTenantContext(request);
    request.tenantContext = tenantContext;

    return true;
  }

  private buildTenantContext(request: AuthenticatedRequest): TenantContext {
    if (this.tenantMode === TenantMode.SINGLE) {
      const userId = request.user?.sub ?? 'system';
      // Prefer the organizationId embedded in the JWT so that requests work
      // correctly even when DEFAULT_ORGANIZATION_ID is not set in .env
      const organizationId = request.user?.organizationId ?? this.defaultOrgId;
      return {
        organizationId,
        userId,
        mode: TenantMode.SINGLE,
        role: request.user?.role ?? 'admin',
        email: request.user?.email,
      };
    }

    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required for multi-tenant mode');
    }

    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException('Organization context missing from token');
    }

    return {
      organizationId,
      userId: user.sub,
      mode: TenantMode.MULTI,
      role: user.role ?? 'member',
      email: user.email,
    };
  }
}
