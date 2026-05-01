import { AdapterConfig } from '../../common/interfaces/adapter.interface';

export interface GmapsAdapterConfig extends AdapterConfig {
  scrollSteps?: number;
  fetchDetails?: boolean;
}

export const GMAPS_PROFILE_KEY = 'gmaps';
export const INTER_QUERY_DELAY_MS = 3000;
