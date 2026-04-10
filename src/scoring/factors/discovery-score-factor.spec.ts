import { scoreDiscoveryFactor } from './discovery-score-factor';

describe('scoreDiscoveryFactor', () => {
  describe('rating scoring', () => {
    it('returns 15 pts for rating >= 4.5', () => {
      const result = scoreDiscoveryFactor({ rating: 4.5 });
      expect(result.score).toBe(15);
    });

    it('returns 10 pts for rating >= 4.0', () => {
      const result = scoreDiscoveryFactor({ rating: 4.0 });
      expect(result.score).toBe(10);
    });

    it('returns 5 pts for rating >= 3.5', () => {
      const result = scoreDiscoveryFactor({ rating: 3.5 });
      expect(result.score).toBe(5);
    });

    it('returns 0 pts for rating < 3.5', () => {
      const result = scoreDiscoveryFactor({ rating: 3.0 });
      expect(result.score).toBe(0);
    });
  });

  describe('review count scoring', () => {
    it('adds 10 pts for reviewCount >= 100', () => {
      const result = scoreDiscoveryFactor({ reviewCount: 150 });
      expect(result.score).toBe(10);
    });

    it('adds 7 pts for reviewCount >= 50', () => {
      const result = scoreDiscoveryFactor({ reviewCount: 75 });
      expect(result.score).toBe(7);
    });

    it('adds 3 pts for reviewCount >= 10', () => {
      const result = scoreDiscoveryFactor({ reviewCount: 25 });
      expect(result.score).toBe(3);
    });

    it('adds 0 pts for reviewCount < 10', () => {
      const result = scoreDiscoveryFactor({ reviewCount: 5 });
      expect(result.score).toBe(0);
    });
  });

  describe('combined scoring', () => {
    it('returns max 25 pts for excellent rating + high reviews', () => {
      const result = scoreDiscoveryFactor({ rating: 4.8, reviewCount: 200 });
      expect(result.score).toBe(25);
      expect(result.maxPossible).toBe(25);
    });

    it('returns combined pts for good rating + moderate reviews', () => {
      const result = scoreDiscoveryFactor({ rating: 4.0, reviewCount: 60 });
      expect(result.score).toBe(17); // 10 + 7
    });

    it('returns 0 for no metadata', () => {
      const result = scoreDiscoveryFactor({});
      expect(result.score).toBe(0);
    });
  });

  describe('factor metadata', () => {
    it('has correct name and maxPossible', () => {
      const result = scoreDiscoveryFactor({ rating: 4.5, reviewCount: 100 });
      expect(result.name).toBe('discovery');
      expect(result.maxPossible).toBe(25);
      expect(result.weight).toBe(1);
    });

    it('includes rating in reasoning', () => {
      const result = scoreDiscoveryFactor({ rating: 4.5 });
      expect(result.reasoning).toContain('4.5');
    });

    it('returns no-signals reasoning when empty', () => {
      const result = scoreDiscoveryFactor({});
      expect(result.reasoning).toContain('No discovery quality signals');
    });
  });
});
