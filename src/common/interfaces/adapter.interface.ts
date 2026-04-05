import { RawLeadInput } from './lead-input.interface';

export interface AdapterConfig {
  organizationId: string;
  campaignId?: string;
  keywords?: string[];
  locations?: string[];
  industries?: string[];
  maxResults?: number;
  filePath?: string;
  webhookSecret?: string;
  [key: string]: unknown;
}

export interface ISourceAdapter {
  readonly name: string;
  readonly sourceType: 'intent' | 'discovery';
  isHealthy(): Promise<boolean>;
  collect(config: AdapterConfig): AsyncGenerator<RawLeadInput>;
}
