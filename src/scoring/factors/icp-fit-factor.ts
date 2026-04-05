import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';
import { ICPConfig } from '../../common/types/icp.types';

export function scoreICPFitFactor(
  leadAttributes: {
    role?: string;
    industry?: string;
    companyStage?: string;
    location?: string;
  },
  icpConfig: ICPConfig,
): ScoringFactor {
  let score = 0;
  const matchedSignals: string[] = [];
  const maxPossible = 20;

  const normalize = (s?: string) => (s ?? '').toLowerCase();

  // Role match (8 points)
  if (
    leadAttributes.role &&
    icpConfig.targetRoles.some((r) => normalize(leadAttributes.role).includes(r.toLowerCase()))
  ) {
    score += 8;
    matchedSignals.push(`role: ${leadAttributes.role}`);
  }

  // Industry match (6 points)
  if (
    leadAttributes.industry &&
    icpConfig.targetIndustries.some((i) => normalize(leadAttributes.industry).includes(i.toLowerCase()))
  ) {
    score += 6;
    matchedSignals.push(`industry: ${leadAttributes.industry}`);
  }

  // Company stage match (4 points)
  if (
    leadAttributes.companyStage &&
    icpConfig.targetStages.some((s) => normalize(leadAttributes.companyStage).includes(s.toLowerCase()))
  ) {
    score += 4;
    matchedSignals.push(`stage: ${leadAttributes.companyStage}`);
  }

  // Location match (2 points)
  if (
    leadAttributes.location &&
    icpConfig.targetLocations?.some((l) => normalize(leadAttributes.location).includes(l.toLowerCase()))
  ) {
    score += 2;
    matchedSignals.push(`location: ${leadAttributes.location}`);
  }

  // Excluded industry penalty
  if (
    leadAttributes.industry &&
    icpConfig.excludedIndustries?.some((e) => normalize(leadAttributes.industry).includes(e.toLowerCase()))
  ) {
    score -= 10;
    matchedSignals.push(`EXCLUDED industry: ${leadAttributes.industry}`);
  }

  return {
    name: 'icp-fit',
    weight: 1,
    score: Math.max(0, Math.min(score, maxPossible)),
    maxPossible,
    reasoning:
      matchedSignals.length > 0
        ? `ICP matches: ${matchedSignals.join(', ')}`
        : 'No ICP signals matched',
  };
}
