import { registerAs } from '@nestjs/config';
import { TenantMode } from '../common/enums/tenant-mode.enum';

export interface TenancyConfig {
  mode: TenantMode;
  defaultOrganizationId: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  apiKeyHeader: string;
}

export default registerAs(
  'tenancy',
  (): TenancyConfig => ({
    mode: (process.env['TENANT_MODE'] as TenantMode) ?? TenantMode.SINGLE,
    defaultOrganizationId: process.env['DEFAULT_ORGANIZATION_ID'] ?? 'default',
    jwtSecret: process.env['JWT_SECRET'] ?? 'change-me-in-production',
    jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
    apiKeyHeader: process.env['API_KEY_HEADER'] ?? 'x-api-key',
  }),
);
