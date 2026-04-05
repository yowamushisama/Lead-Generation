import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';

const COMPETITOR_SIGNALS = [
  /we (offer|provide|build|develop)/i,
  /our (service|product|company|agency)/i,
  /check out our/i,
  /dm me for (our|my) service/i,
];

const ALREADY_HIRED_SIGNALS = [
  /already hired/i,
  /found someone/i,
  /project is (done|complete|finished)/i,
  /working with .{0,20} (already|now)/i,
];

const JOB_SEEKER_SIGNALS = [
  /looking for (a job|work|employment|opportunities)/i,
  /open to (work|opportunities)/i,
  /available for hire/i,
  /#opentowork/i,
];

export function scoreNegativeFactors(content?: string): ScoringFactor {
  if (!content) {
    return { name: 'negative', weight: 1, score: 0, maxPossible: 0, reasoning: 'No negative signals' };
  }

  let penalty = 0;
  const detected: string[] = [];

  if (COMPETITOR_SIGNALS.some((r) => r.test(content))) {
    penalty -= 20;
    detected.push('competitor signal');
  }

  if (ALREADY_HIRED_SIGNALS.some((r) => r.test(content))) {
    penalty -= 15;
    detected.push('already hired');
  }

  if (JOB_SEEKER_SIGNALS.some((r) => r.test(content))) {
    penalty -= 25;
    detected.push('job seeker');
  }

  return {
    name: 'negative',
    weight: 1,
    score: penalty,
    maxPossible: 0,
    reasoning:
      detected.length > 0 ? `Negative signals: ${detected.join(', ')}` : 'No negative signals',
  };
}
