export interface ICPChangeLogEntry {
  profileId: string;
  organizationId: string;
  changedBy?: string | null;
  fieldName: string;
  beforeValue: unknown;
  afterValue: unknown;
  fromVersion: number;
  toVersion: number;
}
