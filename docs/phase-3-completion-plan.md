# Phase 3 Completion Plan — LinkedIn Adapter, Google Maps Adapter & Dual Scoring

**Status:** Implemented
**Date:** 2026-04-05

---

## Overview

Phase 3 was ~70% complete. This plan covers the final 4 critical items needed for live lead discovery:

1. LinkedIn Adapter — Playwright + stealth + session management + proxy rotation
2. Google Maps Adapter — Places API
3. Dual scoring tracks — intent vs discovery
4. Register all new adapters in AdaptersModule

Without these, the system only works with CSV/webhook imports — no autonomous lead discovery.

---

## Files Created

| File | Purpose |
|---|---|
| `src/adapters/linkedin/linkedin-stealth.service.ts` | Playwright browser launch with stealth fingerprint patching |
| `src/adapters/linkedin/linkedin-session.service.ts` | Persistent LinkedIn session via Redis cookie cache |
| `src/adapters/linkedin/linkedin-proxy.service.ts` | Residential proxy pool with round-robin rotation |
| `src/adapters/linkedin/linkedin.adapter.ts` | LinkedIn post scraper (sourceType: intent) |
| `src/adapters/google-maps/google-maps.adapter.ts` | Google Maps Places API scraper (sourceType: discovery) |
| `src/scoring/factors/discovery-score-factor.ts` | Quality-based scoring factor (rating + review count) |
| `src/scoring/factors/discovery-score-factor.spec.ts` | Unit tests for discovery factor |
| `src/scoring/scoring-engine.spec.ts` | Dual-track scoring unit tests |
| `src/adapters/google-maps/google-maps.adapter.spec.ts` | Google Maps adapter unit tests |

---

## Files Modified

| File | Change |
|---|---|
| `src/adapters/adapters.module.ts` | Registered LinkedIn + Google Maps adapters; imported DatabaseModule |
| `src/scoring/scoring-engine.service.ts` | Added `track: 'intent' \| 'discovery'` parameter to `compute()`; split into `buildIntentFactors()` / `buildDiscoveryFactors()` |
| `src/scoring/thresholds.ts` | Added `DISCOVERY_THRESHOLDS` and `getDiscoveryTier()` |
| `src/config/scraping.config.ts` | Added LinkedIn session/proxy fields and `googleMapsApiKey` |
| `src/pipeline/stages/lead-scorer.stage.ts` | Added `scoringTrack` and `discoveryMetadata` to `LeadScorerInput`; discovery leads bypass confidence threshold |
| `src/pipeline/processors/scoring.processor.ts` | Reads `lead.sourceType` → passes correct track to scorer |
| `package.json` | Added `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `@googlemaps/google-maps-services-js` |

---

## Architecture

### LinkedIn Adapter Stack

```
LinkedInAdapter
  └── LinkedInSessionService
        ├── LinkedInStealthService  (Playwright + stealth plugin)
        └── RedisService            (cookie cache, 12h TTL)
  └── LinkedInProxyService          (round-robin residential proxies)
```

**Stealth measures applied:**
- `navigator.webdriver = false` via `addInitScript`
- Randomised viewport, user-agent, timezone, accept-language
- Human-like mouse movements + random delays (500–2500ms)
- CAPTCHA/checkpoint detection → proxy rotation

**Session flow:**
1. Check Redis for `linkedin:session:{email}` (12h TTL)
2. If hit → restore cookies → validate session (nav element check)
3. If miss/expired → run login flow → cache cookies in Redis

### Google Maps Adapter

```
GoogleMapsAdapter
  └── @googlemaps/google-maps-services-js (Client.textSearch)
```

- Iterates `locations × industries` combinations
- Pagination via `next_page_token` with mandatory 2s delay between pages
- Maps result to `RawLeadInput` with `metadata.rating`, `metadata.reviewCount`, `metadata.placeId`

### Dual Scoring Tracks

```
ScoringEngineService.compute(input, track)
  ├── track: 'intent'    → intent + urgency + role + recency + budget + ICP + negative
  └── track: 'discovery' → discovery (rating+reviews) + role + ICP + negative
```

**Intent track** — unchanged existing behaviour, uses `intentConfidence` as primary signal.

**Discovery track** — intent signals are absent (Google Maps has no posts), replaced by:

| Factor | Max Points | Signal |
|---|---|---|
| Discovery (rating) | 15 | ≥4.5→15, ≥4.0→10, ≥3.5→5 |
| Discovery (reviews) | 10 | ≥100→10, ≥50→7, ≥10→3 |
| Role match | — | existing `role-factor` |
| ICP fit | 20 | existing `icp-fit-factor` |
| Negative factors | penalty | existing `negative-factors` |

Discovery leads bypass the `meetsConfidenceThreshold` check (no `intentConfidence`).

---

## Environment Variables Required

```env
# LinkedIn scraping
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=your_password
LINKEDIN_HEADLESS=true           # set to 'false' for debug visibility
LINKEDIN_PROXY_LIST=host1:port1:user:pass,host2:port2:user:pass

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

---

## Installation

```bash
npm install playwright playwright-extra puppeteer-extra-plugin-stealth @googlemaps/google-maps-services-js

# Install Playwright browser binaries (Chromium)
npx playwright install chromium
```

---

## Verification Checklist

- [ ] Unit tests pass: `npm test -- --testPathPattern=discovery-score-factor`
- [ ] Unit tests pass: `npm test -- --testPathPattern=scoring-engine`
- [ ] Unit tests pass: `npm test -- --testPathPattern=google-maps.adapter`
- [ ] Set env vars: `LINKEDIN_EMAIL`, `LINKEDIN_PASSWORD`, `GOOGLE_MAPS_API_KEY`
- [ ] Trigger `daily-scrape.job.ts` manually via endpoint
- [ ] Verify LinkedIn posts enter intent pipeline (check DB `source = 'linkedin'`)
- [ ] Verify Google Maps results enter discovery pipeline (check DB `source = 'google_maps'`)
- [ ] Confirm leads appear with correct `tier` values
- [ ] Verify proxy rotation logs in output
- [ ] Confirm no CAPTCHA triggered (stealth working)
- [ ] Discovery leads have `scoreBreakdown.factors` containing `discovery` (not `intent`)

---

## Scoring Thresholds Reference

### Intent Track (existing)
| Tier | Score |
|---|---|
| HOT | ≥ 20 |
| WARM | 10–19 |
| COLD | < 10 |

### Discovery Track (new)
| Tier | Score |
|---|---|
| HOT | ≥ 30 |
| WARM | 15–29 |
| COLD | < 15 |

---

## Known Limitations

1. **LinkedIn phone/website not extracted** — LinkedIn post search doesn't expose contact details; enrichment stage handles this separately.
2. **Google Maps phone/website** — Basic `textSearch` response doesn't include `formatted_phone_number` or `website`; a Place Details API call per result would be needed to populate these fields.
3. **LinkedIn 2FA** — If a checkpoint page is encountered, the system logs a warning but cannot auto-resolve. Manual action or a pre-authenticated session cookie is required.
4. **Playwright binaries** — `npx playwright install chromium` must be run after `npm install` in each deployment environment.
##Gaps


  ┌──────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────┐
  │             Gap              │                                        Impact                                        │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ extractPosts uses best-guess │ LinkedIn changes its DOM frequently — selectors will silently return 0 posts when    │
  │  CSS selectors               │ the markup changes. No fallback count/alert.                                         │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ 2FA/checkpoint is logged but │ If login hits a checkpoint, the session is cached in a broken state and every        │
  │  not handled                 │ subsequent restore will fail silently (no exception thrown, no session               │
  │                              │ invalidation).                                                                       │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ isRateLimited only checks    │ Soft blocks (showing a CAPTCHA inline without a URL change) are missed.              │
  │ URL                          │                                                                                      │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ Session is tied to a single  │ No multi-account rotation — if the account gets restricted, the whole adapter stops. │
  │ LINKEDIN_EMAIL               │                                                                                      │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ No retry budget              │ The proxy-rotation retry in collect runs once then falls through to extractPosts     │
  │                              │ regardless; a second checkpoint on the new proxy is not handled.                     │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ redis.set without awaiting   │ set + expire are two separate commands — a crash between them leaves a session key   │
  │ expiry atomically            │ that never expires. Should use SET … EX in one call.                                 │
  └──────────────────────────────┴─────────────────────────────────────────────────────────