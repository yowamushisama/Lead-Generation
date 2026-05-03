import { WebsiteEnricherStage } from './website-enricher.stage';

// Minimal HTML wrapper — only the fragment under test matters.
function html(fragment: string): string {
  return `<html><head><title>Test</title></head><body>${fragment}</body></html>`;
}

describe('WebsiteEnricherStage — deep signal detection', () => {
  let stage: WebsiteEnricherStage;

  beforeEach(() => {
    stage = new WebsiteEnricherStage();
  });

  // ── Chatbot vendors ──────────────────────────────────────────────────────────

  it('detects Intercom chatbot', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        html('<script src="https://widget.intercom.io/widget/abc123"></script>'),
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.enrichmentStatus).toBe('OK');
    expect(out.websiteAudit?.deepSignals?.hasChatbot).toBe(true);
    expect(out.websiteAudit?.deepSignals?.chatbotVendor).toBe('intercom');
  });

  it('detects Drift chatbot', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => html('<script src="https://js.driftt.com/include/drift.js"></script>'),
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.websiteAudit?.deepSignals?.hasChatbot).toBe(true);
    expect(out.websiteAudit?.deepSignals?.chatbotVendor).toBe('drift');
  });

  // ── Booking vendors ──────────────────────────────────────────────────────────

  it('detects Calendly booking widget', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        html('<script src="https://assets.calendly.com/assets/external/widget.js"></script>'),
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.websiteAudit?.deepSignals?.hasBookingWidget).toBe(true);
    expect(out.websiteAudit?.deepSignals?.bookingVendor).toBe('calendly');
  });

  it('detects ServiceTitan booking', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        html('<iframe src="https://servicetitan.com/online-booking/widget"></iframe>'),
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.websiteAudit?.deepSignals?.hasBookingWidget).toBe(true);
    expect(out.websiteAudit?.deepSignals?.bookingVendor).toBe('servicetitan');
  });

  // ── JSON-LD schema ───────────────────────────────────────────────────────────

  it('detects LocalBusiness JSON-LD schema', async () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Acme Plumbing',
    });

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        html(
          `<script type="application/ld+json">${jsonLd}</script>`,
        ),
    } as any);

    const out = await stage.process('https://example.com');
    const ds = out.websiteAudit?.deepSignals!;
    expect(ds.hasSchemaMarkup).toBe(true);
    expect(ds.schemaTypes).toContain('LocalBusiness');
  });

  it('detects AggregateRating via @graph → hasReviewSchema', async () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Plumber', name: 'Acme' },
        { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '312' },
      ],
    });

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        html(`<script type="application/ld+json">${jsonLd}</script>`),
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.websiteAudit?.deepSignals?.hasReviewSchema).toBe(true);
  });

  it('detects FAQPage schema → hasFAQSchema', async () => {
    const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage' });

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        html(`<script type="application/ld+json">${jsonLd}</script>`),
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.websiteAudit?.deepSignals?.hasFAQSchema).toBe(true);
  });

  // ── Emergency positioning ────────────────────────────────────────────────────

  it('marks emergencyPositioning=prominent when ≥3 emergency keywords', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        html(
          '<p>24/7 Emergency Service</p><p>Emergency Repair Available</p><p>Emergency Plumbing Response</p>',
        ),
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.websiteAudit?.deepSignals?.emergencyPositioning).toBe('prominent');
  });

  it('marks emergencyPositioning=mentioned for 1-2 occurrences', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => html('<p>Emergency service available</p>'),
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.websiteAudit?.deepSignals?.emergencyPositioning).toBe('mentioned');
  });

  it('marks emergencyPositioning=none with no keywords', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => html('<p>We offer great plumbing services.</p>'),
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.websiteAudit?.deepSignals?.emergencyPositioning).toBe('none');
  });

  // ── No website ───────────────────────────────────────────────────────────────

  it('returns NO_WEBSITE status for empty input', async () => {
    const out = await stage.process('');
    expect(out.enrichmentStatus).toBe('NO_WEBSITE');
    expect(out.websiteAudit).toBeNull();
  });

  // ── Unreachable / timeout ────────────────────────────────────────────────────

  it('returns UNREACHABLE when fetch returns non-ok status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    } as any);

    const out = await stage.process('https://example.com');
    expect(out.enrichmentStatus).toBe('UNREACHABLE');
  });

  it('returns TIMEOUT when fetch aborts', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(
      Object.assign(new Error('abort'), { name: 'AbortError' }),
    );

    const out = await stage.process('https://example.com');
    expect(out.enrichmentStatus).toBe('TIMEOUT');
  });
});
