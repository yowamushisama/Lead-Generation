export interface RawLeadInput {
  externalId?: string;
  source: string;
  sourceUrl?: string;
  sourceType?: string;
  name: string;
  headline?: string;
  bio?: string;
  role?: string;
  company?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  email?: string;
  phone?: string;
  website?: string;
  hasMeaningfulWebsite?: boolean;
  originalContent?: string;
  metadata?: Record<string, unknown>;
}
