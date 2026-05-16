import {
  classifyWebsite,
  evaluateGmapsFilters,
  requiresDetailExtraction,
} from './gmaps-filter';
import type { GmapsPlace } from './gmaps-extraction.types';

const place = (overrides: Partial<GmapsPlace> = {}): GmapsPlace => ({
  placeId: 'ChIJtest',
  name: 'Acme Plumbing',
  rating: 4.5,
  reviewCount: 42,
  category: 'Plumber',
  googleTypes: ['Plumber'],
  address: '123 Main St',
  phone: '+15555550123',
  website: 'https://acme.example.com',
  yearsInBusiness: 5,
  businessHours: null,
  lastReviewAt: null,
  socialHandles: {},
  sourceUrl: 'https://www.google.com/maps/place/acme',
  ...overrides,
});

describe('gmaps-filter', () => {
  describe('classifyWebsite', () => {
    it('classifies real business domains as meaningful', () => {
      expect(classifyWebsite('https://www.acme.example.com/path?x=facebook.com')).toBe(true);
      expect(classifyWebsite('acme.example.com/contact')).toBe(true);
    });

    it('classifies missing, blank, invalid, and social hosts as not meaningful', () => {
      expect(classifyWebsite(null)).toBe(false);
      expect(classifyWebsite('')).toBe(false);
      expect(classifyWebsite('   ')).toBe(false);
      expect(classifyWebsite('http://')).toBe(false);
      expect(classifyWebsite('https://www.facebook.com/acme')).toBe(false);
      expect(classifyWebsite('HTTPS://INSTAGRAM.COM/acme')).toBe(false);
      expect(classifyWebsite('linktr.ee/acme')).toBe(false);
    });

    it('returns null only when no website field was provided', () => {
      expect(classifyWebsite(undefined)).toBeNull();
    });
  });

  describe('evaluateGmapsFilters', () => {
    it('passes when filters are absent or satisfied', () => {
      expect(evaluateGmapsFilters(place()).passed).toBe(true);
      expect(
        evaluateGmapsFilters(place(), {
          minRating: 4,
          minReviewCount: 20,
          minYearsInBusiness: 2,
          websitePresence: 'any',
        }),
      ).toEqual({ passed: true, reasons: [] });
    });

    it('collects independent failure reasons', () => {
      expect(
        evaluateGmapsFilters(place({ rating: 3, reviewCount: 1, yearsInBusiness: null }), {
          minRating: 4,
          minReviewCount: 10,
          minYearsInBusiness: 2,
        }),
      ).toEqual({ passed: false, reasons: ['rating', 'reviews', 'years'] });
    });

    it('handles website presence modes', () => {
      expect(evaluateGmapsFilters(place({ website: null }), { websitePresence: 'none' }).passed).toBe(true);
      expect(evaluateGmapsFilters(place({ website: 'https://facebook.com/acme' }), { websitePresence: 'none' })).toEqual({
        passed: false,
        reasons: ['website'],
      });
      expect(
        evaluateGmapsFilters(place({ website: 'https://instagram.com/acme' }), {
          websitePresence: 'none_or_social_only',
        }).passed,
      ).toBe(true);
      expect(
        evaluateGmapsFilters(place({ website: 'https://acme.example.com' }), {
          websitePresence: 'none_or_social_only',
        }),
      ).toEqual({ passed: false, reasons: ['website'] });
    });
  });

  describe('requiresDetailExtraction', () => {
    it('requires detail extraction only for social-only website classification or years filters', () => {
      expect(requiresDetailExtraction()).toBe(false);
      expect(requiresDetailExtraction({ minRating: 4, minReviewCount: 10 })).toBe(false);
      expect(requiresDetailExtraction({ websitePresence: 'any' })).toBe(false);
      expect(requiresDetailExtraction({ websitePresence: 'none' })).toBe(false);
      expect(requiresDetailExtraction({ websitePresence: 'none_or_social_only' })).toBe(true);
      expect(requiresDetailExtraction({ minYearsInBusiness: 2 })).toBe(true);
    });
  });
});
