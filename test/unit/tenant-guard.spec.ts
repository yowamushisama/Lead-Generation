import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantGuard } from '../../src/common/guards/tenant.guard';
import { TenantMode } from '../../src/common/enums/tenant-mode.enum';
import { TenantContext } from '../../src/common/interfaces/tenant-context.interface';

interface MockRequest {
  user?: {
    sub: string;
    email: string;
    organizationId?: string;
    role?: string;
  };
  tenantContext?: TenantContext;
  headers: Record<string, string>;
}

function createMockExecutionContext(request: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  let guard: TenantGuard;

  const mockConfigService = {
    get: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Single-tenant mode', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'TENANT_MODE') return TenantMode.SINGLE;
        if (key === 'DEFAULT_ORGANIZATION_ID') return 'default';
        return undefined;
      });
      guard = new TenantGuard(mockConfigService as unknown as ConfigService);
    });

    it('should inject default organizationId in single-tenant mode', () => {
      const request: MockRequest = {
        user: { sub: 'user-123', email: 'user@test.com', role: 'admin' },
        headers: {},
      };

      const context = createMockExecutionContext(request);
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.tenantContext).toBeDefined();
      expect(request.tenantContext?.organizationId).toBe('default');
      expect(request.tenantContext?.mode).toBe(TenantMode.SINGLE);
    });

    it('should work without authenticated user in single-tenant mode', () => {
      const request: MockRequest = {
        headers: {},
      };

      const context = createMockExecutionContext(request);
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.tenantContext?.organizationId).toBe('default');
      expect(request.tenantContext?.userId).toBe('system');
    });

    it('should set role to admin when user is present in single mode', () => {
      const request: MockRequest = {
        user: { sub: 'user-456', email: 'admin@test.com', role: 'admin' },
        headers: {},
      };

      const context = createMockExecutionContext(request);
      guard.canActivate(context);

      expect(request.tenantContext?.role).toBe('admin');
    });
  });

  describe('Multi-tenant mode', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'TENANT_MODE') return TenantMode.MULTI;
        if (key === 'DEFAULT_ORGANIZATION_ID') return 'default';
        return undefined;
      });
      guard = new TenantGuard(mockConfigService as unknown as ConfigService);
    });

    it('should extract organizationId from JWT payload', () => {
      const request: MockRequest = {
        user: {
          sub: 'user-123',
          email: 'user@tenant.com',
          organizationId: 'org-abc-123',
          role: 'member',
        },
        headers: {},
      };

      const context = createMockExecutionContext(request);
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.tenantContext?.organizationId).toBe('org-abc-123');
      expect(request.tenantContext?.userId).toBe('user-123');
      expect(request.tenantContext?.mode).toBe(TenantMode.MULTI);
      expect(request.tenantContext?.role).toBe('member');
    });

    it('should throw UnauthorizedException when no user in multi-tenant mode', () => {
      const request: MockRequest = {
        headers: {},
      };

      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when organizationId missing from token', () => {
      const request: MockRequest = {
        user: {
          sub: 'user-123',
          email: 'user@test.com',
        },
        headers: {},
      };

      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should preserve email in tenant context', () => {
      const request: MockRequest = {
        user: {
          sub: 'user-789',
          email: 'specific@tenant.com',
          organizationId: 'org-xyz',
          role: 'admin',
        },
        headers: {},
      };

      const context = createMockExecutionContext(request);
      guard.canActivate(context);

      expect(request.tenantContext?.email).toBe('specific@tenant.com');
    });
  });

  describe('TenantGuard initialization', () => {
    it('should default to single-tenant mode when TENANT_MODE is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);
      guard = new TenantGuard(mockConfigService as unknown as ConfigService);

      const request: MockRequest = { headers: {} };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
      expect(request.tenantContext?.mode).toBe(TenantMode.SINGLE);
    });
  });
});
