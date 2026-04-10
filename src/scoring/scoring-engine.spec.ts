import { ScoringEngineService } from './scoring-engine.service';
import { IntentResult } from '../common/types/intent.types';

const mockIntent: IntentResult = {
  intentType: 'BUYING' as any,
  intentUrgency: 'HIGH' as any,
  intentConfidence: 0.9,
  isBuyer: true,
  intentReasoning: 'Looking to buy software',
  painPoints: ['needs CRM'],
  fears: [],
  desires: [],
  budgetSignal: undefined,
  hiringIntent: false,
  companyStage: 'startup',
  technicalLevel: 'high',
};

const emptyIntent: IntentResult = {
  intentType: 'UNKNOWN' as any,
  intentUrgency: 'NONE' as any,
  intentConfidence: 0,
  isBuyer: false,
  intentReasoning: '',
  painPoints: [],
  fears: [],
  desires: [],
  budgetSignal: undefined,
  hiringIntent: false,
  companyStage: undefined,
  technicalLevel: undefined,
};

describe('ScoringEngineService — dual track', () => {
  let service: ScoringEngineService;

  beforeEach(() => {
    service = new ScoringEngineService();
  });

  describe('intent track (default)', () => {
    it('produces a positive score for a high-confidence buying lead', () => {
      const result = service.compute({ intent: mockIntent });
      expect(result.score).toBeGreaterThan(0);
      expect(result.breakdown.factors.map((f) => f.name)).toContain('intent');
      expect(result.breakdown.factors.map((f) => f.name)).toContain('urgency');
    });

    it('includes intent, urgency, recency, budget factors', () => {
      const result = service.compute({ intent: mockIntent }, 'intent');
      const factorNames = result.breakdown.factors.map((f) => f.name);
      expect(factorNames).toContain('intent');
      expect(factorNames).toContain('urgency');
    });
  });

  describe('discovery track', () => {
    it('uses discovery factor instead of intent/urgency factors', () => {
      const result = service.compute(
        {
          intent: emptyIntent,
          discoveryMetadata: { rating: 4.5, reviewCount: 120 },
        },
        'discovery',
      );
      const factorNames = result.breakdown.factors.map((f) => f.name);
      expect(factorNames).toContain('discovery');
      expect(factorNames).not.toContain('intent');
      expect(factorNames).not.toContain('urgency');
    });

    it('produces a non-zero score for high-quality discovery lead', () => {
      const result = service.compute(
        {
          intent: emptyIntent,
          discoveryMetadata: { rating: 4.7, reviewCount: 200 },
        },
        'discovery',
      );
      expect(result.score).toBeGreaterThan(0);
    });

    it('same input produces different breakdowns for intent vs discovery', () => {
      const input = { intent: mockIntent, discoveryMetadata: { rating: 4.5, reviewCount: 100 } };
      const intentResult = service.compute(input, 'intent');
      const discoveryResult = service.compute(input, 'discovery');

      const intentFactors = intentResult.breakdown.factors.map((f) => f.name);
      const discoveryFactors = discoveryResult.breakdown.factors.map((f) => f.name);

      expect(intentFactors).toContain('intent');
      expect(discoveryFactors).not.toContain('intent');
      expect(discoveryFactors).toContain('discovery');
    });
  });
});
