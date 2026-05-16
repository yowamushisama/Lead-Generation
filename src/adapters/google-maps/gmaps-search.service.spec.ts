import { Test } from '@nestjs/testing';
import { GmapsSearchService, FastScrollResult } from './gmaps-search.service';
import { PlaywrightStealthService } from '../shared/playwright-stealth.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Build URLs that encode a placeId so gmapsListingKey can extract a stable key.
const makeUrl = (id: string) =>
  `https://www.google.com/maps/place/Place+${id}/data=!19sChIJ${id}`;

// Build a minimal Page mock. collectListingUrls calls page.evaluate() with a
// selector list and returns hrefs; scrollPage calls scrollBy/scrollTo on the container.
function makePageMock(urlsPerScroll: string[][] | (() => string[])) {
  let callIndex = 0;
  const getUrls = typeof urlsPerScroll === 'function'
    ? urlsPerScroll
    : () => urlsPerScroll[Math.min(callIndex++, urlsPerScroll.length - 1)] ?? [];

  return {
    evaluate: jest.fn().mockImplementation(() => Promise.resolve(getUrls())),
    $: jest.fn().mockResolvedValue(null), // findFeedContainer → returns null → uses fallback
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    // scrollPage calls page.evaluate for the scroll itself
  } as unknown as any;
}

// ── Module setup ──────────────────────────────────────────────────────────────

describe('GmapsSearchService.fastScrollProbe', () => {
  let service: GmapsSearchService;

  const mockStealth = {
    newPage: jest.fn(),
    randomDelayMs: jest.fn().mockReturnValue(100),
  } as unknown as PlaywrightStealthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GmapsSearchService,
        { provide: PlaywrightStealthService, useValue: mockStealth },
      ],
    }).compile();
    service = module.get(GmapsSearchService);
  });

  // ── NO_PROBE ───────────────────────────────────────────────────────────────

  it('returns NO_PROBE when cursorTailIds.length < minTailForProbe', async () => {
    const page = makePageMock([]);
    const result = await service.fastScrollProbe(page, {
      cursorTailIds: ['a', 'b'],  // length 2 < default 10
      cursorSeenIds: new Set(),
      anchor: null,
      budget: 40,
      maxMs: 90_000,
    });

    expect(result.mode).toBe('NORMAL');
    expect(result.reason).toBe('NO_PROBE');
    expect(result.scrolls).toBe(0);
    expect(result.knownDuplicateKeys.size).toBe(0);
    expect(result.freshProbeListings).toHaveLength(0);
    expect(page.evaluate).not.toHaveBeenCalled();
  });

  // ── NORMAL_FROM_ANCHOR ────────────────────────────────────────────────────

  it('returns NORMAL_FROM_ANCHOR when the anchor key appears in the DOM', async () => {
    const anchorId = 'AAA';
    const anchorUrl = makeUrl(anchorId);
    const anchorKey = `ChIJ${anchorId}`;  // gmapsListingKey extracts the ChIJ part

    // tailIds from previous run (10 entries to pass MIN_TAIL)
    const tailIds = Array.from({ length: 10 }, (_, i) => `ChIJTail${i}`);
    // The anchor was extracted in the previous run, so it must also be in seenExternalIds.
    const seenIds = new Set([...tailIds, anchorKey]);

    // On first scroll: DOM shows a fresh listing ABOVE the anchor, then tail URLs.
    // The fresh URL must be collected before the probe encounters the anchor and returns.
    const domUrls = [
      makeUrl('Brand_New_1'), // fresh — appears above the anchor (the v1 bug scenario)
      makeUrl('Tail0'), makeUrl('Tail1'), makeUrl('Tail2'),
      anchorUrl,
    ];

    const page = makePageMock([domUrls]);

    const result = await service.fastScrollProbe(page, {
      cursorTailIds: tailIds,
      cursorSeenIds: seenIds,
      anchor: anchorKey,
      budget: 40,
      maxMs: 90_000,
    });

    expect(result.mode).toBe('NORMAL_FROM_ANCHOR');
    expect(result.reason).toBe('ANCHOR_HIT');
    expect(result.scrolls).toBe(1);
    // Anchor and tail URLs are known dups; fresh URL is separate
    expect(result.knownDuplicateKeys.has(anchorKey)).toBe(true);
    expect(result.freshProbeListings.some((l) => l.url === makeUrl('Brand_New_1'))).toBe(true);
  });

  // ── NORMAL_FROM_TAIL ──────────────────────────────────────────────────────

  it('returns NORMAL_FROM_TAIL when ≥40% of tail IDs are encountered', async () => {
    // 10 tail IDs; threshold = 0.4 → need ≥4 hits
    const tailIds = Array.from({ length: 10 }, (_, i) => `ChIJTail${i}`);

    // DOM returns 5 tail URLs on scroll 1 → hitRate = 5/10 = 0.5 ≥ 0.4
    const domUrls = Array.from({ length: 5 }, (_, i) => makeUrl(`Tail${i}`));

    const page = makePageMock([domUrls]);

    const result = await service.fastScrollProbe(page, {
      cursorTailIds: tailIds,
      cursorSeenIds: new Set(tailIds),
      anchor: null,
      budget: 40,
      maxMs: 90_000,
    });

    expect(result.mode).toBe('NORMAL_FROM_TAIL');
    expect(result.reason).toBe('TAIL_THRESHOLD_MET');
    expect(result.hitRate).toBeGreaterThanOrEqual(0.4);
    expect(result.knownDuplicateKeys.size).toBe(5);
    expect(result.freshProbeListings).toHaveLength(0);
  });

  // ── NORMAL_FRESH (shuffle detected) ──────────────────────────────────────

  it('returns NORMAL_FRESH with empty sets when feed is shuffled (no overlap after minShuffleDetect scrolls)', async () => {
    const tailIds = Array.from({ length: 10 }, (_, i) => `ChIJTail${i}`);

    // DOM always returns completely different URLs — zero overlap with tailIds
    const domUrls = Array.from({ length: 5 }, (_, i) => makeUrl(`Totally_New_${i}`));
    // Return same fresh urls on every scroll so hits always stays 0
    const page = makePageMock(() => domUrls);

    const result = await service.fastScrollProbe(page, {
      cursorTailIds: tailIds,
      cursorSeenIds: new Set(tailIds),
      anchor: null,
      budget: 40,
      maxMs: 90_000,
      minShuffleDetect: 3,  // low threshold so test runs fast
    });

    expect(result.mode).toBe('NORMAL_FRESH');
    expect(result.reason).toBe('NO_OVERLAP_SHUFFLE');
    expect(result.knownDuplicateKeys.size).toBe(0);
    expect(result.freshProbeListings).toHaveLength(0);
    expect(result.scrolls).toBe(3);
  });

  // ── NORMAL_FROM_PARTIAL (budget exhausted) ───────────────────────────────

  it('returns NORMAL_FROM_PARTIAL when budget exhausts before threshold', async () => {
    // 10 tail IDs; only 2 appear in DOM → hitRate = 0.2 < threshold 0.4
    const tailIds = Array.from({ length: 10 }, (_, i) => `ChIJTail${i}`);
    const domUrls = [makeUrl('Tail0'), makeUrl('Tail1'), makeUrl('Fresh1')];

    const page = makePageMock(() => domUrls);

    const result = await service.fastScrollProbe(page, {
      cursorTailIds: tailIds,
      cursorSeenIds: new Set(tailIds),
      anchor: null,
      budget: 2,  // tight budget so we exhaust before threshold
      maxMs: 90_000,
      minShuffleDetect: 999,  // disable shuffle detection
    });

    expect(result.mode).toBe('NORMAL_FROM_PARTIAL');
    expect(result.reason).toBe('BUDGET_EXHAUSTED');
    expect(result.scrolls).toBe(2);
    expect(result.knownDuplicateKeys.size).toBeGreaterThan(0);
  });

  // ── Fresh-above-anchor correctness (the v1 bug) ───────────────────────────

  it('puts a fresh listing above the anchor into freshProbeListings, NOT knownDuplicateKeys', async () => {
    const anchorId = 'ANCHOR';
    const anchorKey = `ChIJ${anchorId}`;
    const tailIds = Array.from({ length: 10 }, (_, i) => `ChIJTail${i}`);

    const freshUrl = makeUrl('BrandNew');

    // DOM on scroll 1: fresh listing appears ABOVE the anchor
    const domUrls = [freshUrl, makeUrl(anchorId)];

    const page = makePageMock([domUrls]);

    const result = await service.fastScrollProbe(page, {
      cursorTailIds: tailIds,
      cursorSeenIds: new Set(tailIds),
      anchor: anchorKey,
      budget: 40,
      maxMs: 90_000,
    });

    expect(result.mode).toBe('NORMAL_FROM_ANCHOR');

    // The fresh URL must be in freshProbeListings, not in knownDuplicateKeys.
    // gmapsListingKey(makeUrl('BrandNew')) extracts 'ChIJBrandNew' from the !19s... segment.
    const freshInKnown = [...result.knownDuplicateKeys].some((k) => k.includes('BrandNew'));
    const freshInFresh = result.freshProbeListings.some((l) => l.url === freshUrl);

    expect(freshInKnown).toBe(false);
    expect(freshInFresh).toBe(true);
  });

  // ── Legacy cursorSeenIds key format ──────────────────────────────────────

  it('recognises a cursorSeenId stored in legacy format (placeIdFromUrl ?? url)', async () => {
    const tailIds = Array.from({ length: 10 }, (_, i) => `ChIJTail${i}`);

    // Legacy entry: a raw URL (no ChIJ in href, so placeIdFromUrl returns null → key = url)
    const legacyUrl = 'https://www.google.com/maps/place/SomeBiz/?cid=1234';
    const seenIdsWithLegacy = new Set<string>([...tailIds, legacyUrl]);

    // DOM returns that same URL
    const page = makePageMock([[legacyUrl]]);

    const result = await service.fastScrollProbe(page, {
      cursorTailIds: tailIds,
      cursorSeenIds: seenIdsWithLegacy,
      anchor: null,
      budget: 1,
      maxMs: 90_000,
      minShuffleDetect: 999,
    });

    // The legacy URL should be classified as known, not fresh.
    // knownDuplicateKeys stores the canonical key (normalizeGmapsUrl output — query stripped),
    // not the raw legacy URL. The raw url is 'https://.../SomeBiz/?cid=1234', canonical is
    // 'https://.../SomeBiz/' (query stripped by normalizeGmapsUrl).
    const canonicalKey = 'https://www.google.com/maps/place/SomeBiz/';
    expect(result.freshProbeListings.some((l) => l.url === legacyUrl)).toBe(false);
    expect(result.knownDuplicateKeys.has(canonicalKey)).toBe(true);
  });
});
