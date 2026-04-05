import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';

const STRONG_BUDGET_SIGNALS = [
  /\$[\d,]+k?/i,
  /budget.{0,30}\d+/i,
  /willing to pay/i,
  /paid.*solution/i,
  /can afford/i,
];

const MEDIUM_BUDGET_SIGNALS = [
  /invest/i,
  /spending/i,
  /cost.*matter/i,
  /not cheap/i,
  /quality.*matter/i,
];

const NEGATIVE_BUDGET_SIGNALS = [/free.*solution/i, /no budget/i, /can't afford/i, /bootstrap/i];

export function scoreBudgetFactor(content?: string, budgetSignal?: string): ScoringFactor {
  const text = [content ?? '', budgetSignal ?? ''].join(' ').toLowerCase();

  if (!text.trim()) {
    return { name: 'budget', weight: 1, score: 0, maxPossible: 10, reasoning: 'No budget signals' };
  }

  if (NEGATIVE_BUDGET_SIGNALS.some((r) => r.test(text))) {
    return { name: 'budget', weight: 1, score: -5, maxPossible: 10, reasoning: 'Negative budget signal detected' };
  }

  let score = 0;

  if (STRONG_BUDGET_SIGNALS.some((r) => r.test(text))) {
    score = 10;
  } else if (MEDIUM_BUDGET_SIGNALS.some((r) => r.test(text))) {
    score = 5;
  }

  return {
    name: 'budget',
    weight: 1,
    score,
    maxPossible: 10,
    reasoning: score > 0 ? `Budget signals detected (score: ${score}/10)` : 'No budget signals found',
  };
}
