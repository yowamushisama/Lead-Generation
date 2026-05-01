import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';

/**
 * Scores how well a lead's Google Maps category types match the campaign's
 * target industries (niche). Catches drift when a search for "plumber"
 * returns hardware stores or unrelated businesses.
 *
 * Max possible: 10 points.
 */
export function scoreNicheFitFactor(
  googleTypes: string[],
  targetIndustries: string[],
): ScoringFactor {
  const maxPossible = 10;

  if (!googleTypes.length || !targetIndustries.length) {
    return {
      name: 'niche-fit',
      weight: 1,
      score: 0,
      maxPossible,
      reasoning: 'Insufficient data for niche match',
    };
  }

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  const normalizedTypes = googleTypes.map(normalize);
  const normalizedIndustries = targetIndustries.map(normalize);

  // Exact match — any type exactly equals an industry term
  const exactMatch = normalizedIndustries.some((ind) =>
    normalizedTypes.some((t) => t === ind),
  );
  if (exactMatch) {
    return {
      name: 'niche-fit',
      weight: 1,
      score: 10,
      maxPossible,
      reasoning: `Exact niche match: ${googleTypes.join(', ')}`,
    };
  }

  // Partial/token match — any word from an industry term appears in a type (or vice versa)
  const partialMatch = normalizedIndustries.some((ind) => {
    const indTokens = ind.split(/\s+/);
    return normalizedTypes.some((t) => {
      const tTokens = t.split(/\s+/);
      return indTokens.some((tok) => tTokens.includes(tok));
    });
  });

  if (partialMatch) {
    return {
      name: 'niche-fit',
      weight: 1,
      score: 5,
      maxPossible,
      reasoning: `Partial niche match: ${googleTypes.join(', ')}`,
    };
  }

  return {
    name: 'niche-fit',
    weight: 1,
    score: 0,
    maxPossible,
    reasoning: `No niche match. Types: [${googleTypes.join(', ')}] vs industries: [${targetIndustries.join(', ')}]`,
  };
}
