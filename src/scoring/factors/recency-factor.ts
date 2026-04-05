import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';

export function scoreRecencyFactor(postedAt?: Date | string): ScoringFactor {
  if (!postedAt) {
    return { name: 'recency', weight: 1, score: 0, maxPossible: 10, reasoning: 'No timestamp available' };
  }

  const posted = new Date(postedAt);
  const ageHours = (Date.now() - posted.getTime()) / (1000 * 60 * 60);

  let score: number;
  let label: string;

  if (ageHours <= 6) {
    score = 10;
    label = 'very fresh (<6h)';
  } else if (ageHours <= 24) {
    score = 8;
    label = 'fresh (<24h)';
  } else if (ageHours <= 48) {
    score = 6;
    label = 'recent (<48h)';
  } else if (ageHours <= 168) {
    score = 3;
    label = 'within a week';
  } else {
    score = 0;
    label = 'older than a week';
  }

  return {
    name: 'recency',
    weight: 1,
    score,
    maxPossible: 10,
    reasoning: `Posted ${ageHours.toFixed(0)}h ago — ${label}`,
  };
}
