export interface ICPConfig {
  targetRoles?: string[];
  targetIndustries?: string[];
  targetStages?: string[];
  targetLocations?: string[];
  buyerSignals?: string[];
  urgencySignals?: string[];
  budgetSignals?: string[];
}

export interface ICPProfile {
  id: string;
  organizationId: string;
  name: string;
  version: number;
  config?: ICPConfig;
  learnedWeights?: Record<string, number>;
  conversionRate?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ICPStats {
  profile: ICPProfile;
  stats: {
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
    version: number;
    learnedWeightsCount: number;
  };
}

export interface CreateICPDto {
  name: string;
  config: ICPConfig;
}
