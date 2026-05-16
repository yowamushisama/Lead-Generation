import { ICPConfig } from '../common/types/icp.types';

export function latestFirst(values: string[]): string[] {
  return [...values].reverse();
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export interface ResolvedTargets {
  locations: string[];
  industries: string[];
  icpConfig: ICPConfig;
}

export function resolveTargets(
  campaign: Record<string, unknown>,
  campaignLocations: string[],
  campaignIndustries: string[],
): ResolvedTargets {
  const icpConfig = ((campaign as any).icpProfile?.config as ICPConfig | null) ?? ({} as ICPConfig);

  const icpLocations = (
    ((campaign as any).icpProfile?.targetLocations as string[] | null ?? []).filter(Boolean).length > 0
      ? ((campaign as any).icpProfile?.targetLocations as string[])
      : (icpConfig.targetLocations ?? [])
  ).filter(Boolean);

  const icpIndustries = (
    ((campaign as any).icpProfile?.targetIndustries as string[] | null ?? []).filter(Boolean).length > 0
      ? ((campaign as any).icpProfile?.targetIndustries as string[])
      : (icpConfig.targetIndustries ?? [])
  ).filter(Boolean);

  return {
    icpConfig,
    locations: campaignLocations.length > 0 ? campaignLocations : icpLocations,
    industries: latestFirst(campaignIndustries.length > 0 ? campaignIndustries : icpIndustries),
  };
}

export function extractGmapsFilters(icpConfig: ICPConfig): Record<string, unknown> | undefined {
  const gmapsCfg = (icpConfig as any)?.sourceFilters?.googleMaps;
  if (gmapsCfg?.enabled !== true) return undefined;
  const { enabled: _enabled, ...filters } = gmapsCfg;
  return Object.keys(filters).length > 0 ? filters : undefined;
}
