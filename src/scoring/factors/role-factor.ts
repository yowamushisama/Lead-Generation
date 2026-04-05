import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';

const HIGH_VALUE_ROLES = ['founder', 'ceo', 'cto', 'coo', 'vp', 'president', 'owner', 'director'];
const MEDIUM_VALUE_ROLES = ['manager', 'head of', 'lead', 'principal', 'senior'];

export function scoreRoleFactor(role?: string): ScoringFactor {
  if (!role) {
    return { name: 'role', weight: 1, score: 0, maxPossible: 10, reasoning: 'Role unknown' };
  }

  const normalized = role.toLowerCase();
  let score = 0;

  if (HIGH_VALUE_ROLES.some((r) => normalized.includes(r))) {
    score = 10;
  } else if (MEDIUM_VALUE_ROLES.some((r) => normalized.includes(r))) {
    score = 5;
  } else {
    score = 2;
  }

  return {
    name: 'role',
    weight: 1,
    score,
    maxPossible: 10,
    reasoning: `Role: ${role} (score: ${score}/10)`,
  };
}
