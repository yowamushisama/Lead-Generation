import { TenantMode } from '../enums/tenant-mode.enum';

export interface TenantContext {
  organizationId: string;
  userId: string;
  mode: TenantMode;
  role?: string;
  email?: string;
}
