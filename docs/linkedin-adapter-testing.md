# LinkedIn Adapter — Testing & Iterative Improvement Guide

## Overview

Two scripts work together to run and improve the LinkedIn adapter:

| Script | npm command | Purpose |
|--------|-------------|---------|
| `src/scripts/test-linkedin-adapter.ts` | `npm run linkedin:test-live` | Run the adapter end-to-end and stream scraped leads |
| `src/scripts/dump-linkedin-dom.ts` | `npm run linkedin:dump-dom` | Capture live DOM + run a selector audit to diagnose and fix broken selectors |

---

## Prerequisites

### 1. Environment variables

Create `.env.local` (or `.env`) in the project root:

```bash
LINKEDIN_EMAIL=your.account@example.com
LINKEDIN_PASSWORD=yourpassword

# Optional — show the browser window while running (useful when debugging)
LINKEDIN_HEADLESS=false

# Optional — comma-separated rotating proxies
LINKEDIN_PROXY_LIST=host:port:user:pass,host2:port2

# Optional — persistent browser profile location (default: data/linkedin-profile/)
LINKEDIN_USER_DATA_DIR=./data/linkedin-profile

# Optional — override keywords without passing CLI flags
LINKEDIN_TEST_KEYWORDS=hiring SDR,b2b saas
```

### 2. Build

Both scripts require a compiled build before running:

```bash
npm run build
```

---

## Running the live test

```bash
# Minimal — one keyword, 10 leads (default)
npm run linkedin:test-live -- --keyword "hiring SDR"

# Multiple keywords, limit total results
npm run linkedin:test-live -- --keyword "b2b saas" --keyword "hiring AE" --max-results 20

# Tag leads with an org and campaign ID (mirrors production usage)
npm run linkedin:test-live -- \
  --keyword "hiring SDR" \
  --organization my-org-id \
  --campaign my-campaign-id

# Emit each lead as a JSON object (useful for piping to jq or saving to file)
npm run linkedin:test-live -- --keyword "hiring SDR" --json > leads.json
```

### CLI flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--keyword` | `-k` | — | Search keyword (repeatable, at least one required) |
| `--max-results` | — | `10` | Total leads to stream across all keywords |
| `--organization` | — | `linkedin-live-test` | `organizationId` stored in lead metadata |
| `--campaign` | — | _(none)_ | `campaignId` stored in lead metadata |
| `--json` | — | `false` | Print each lead as formatted JSON |
| `--help` | `-h` | — | Print usage and exit |

### What to look for in output

```
Starting live LinkedIn adapter test
keywords: hiring SDR
maxResults: 10
headless: true
linkedin reachable: true          ← if false, check network / proxy

[lead 1] Jane Smith
headline: VP Sales at Acme Corp
profile: /in/jane-smith
keyword: hiring SDR
postedAt: 2026-04-14T09:30:00.000Z
content: We're hiring...

Completed live LinkedIn adapter test with 8 lead(s).
```

**Red flags that indicate selector drift or auth issues:**
- `linkedin reachable: false` — network or proxy problem
- `0 lead(s)` at the end with no errors — selectors are returning empty sets
- `Error scraping LinkedIn for keyword` in logs — check the stack trace
- Process exits immediately after login — rate-limit or CAPTCHA challenge

---

## Running the DOM dumper

Use this script whenever the live test returns 0 leads or you suspect LinkedIn has changed their DOM structure.

```bash
# Basic usage
npm run linkedin:dump-dom -- --keyword "hiring SDR"

# Capture more card HTML snippets for deeper inspection
npm run linkedin:dump-dom -- --keyword "b2b saas" --max-cards 10

# Write output to a custom directory
npm run linkedin:dump-dom -- --keyword "hiring SDR" --output-dir ./debug-dumps
```

### CLI flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--keyword` | `-k` | — | Search keyword (required) |
| `--max-cards` | — | `5` | Number of card HTML snippets to save |
| `--output-dir` | `-o` | `linkedin-dom-dumps/` | Directory for output files |
| `--help` | `-h` | — | Print usage and exit |

### Output files

Three files are written to `linkedin-dom-dumps/` (or your `--output-dir`):

```
linkedin-dom-dumps/
  2026-04-15T10-30_hiring-SDR_report.txt   ← selector audit + fix instructions
  2026-04-15T10-30_hiring-SDR_cards.html   ← outer HTML of the first N cards
  2026-04-15T10-30_hiring-SDR_full.html    ← complete page HTML
```

The `_report.txt` contains a selector audit table, for example:

```
POST CONTAINERS
  ✓ [data-urn*="activity"]                              12 element(s) ← ACTIVE
  ✗ [data-urn*="ugcPost"]                                0 element(s)
  ✗ .occludable-update                                   0 element(s)

AUTHOR NAME
  ✗ .update-components-actor__meta-link                  0 element(s)
  ✗ .update-components-actor__title a                    0 element(s)
  ...

Status: ✗  2 selector group(s) failed — update linkedin-selectors.config.ts
```

A `✗` with `0 element(s)` on the ACTIVE line means that selector group is broken.

---

## Iterative improvement workflow

### Step 1 — Identify what is broken

```bash
npm run build && npm run linkedin:test-live -- --keyword "hiring SDR" --max-results 5
```

If you get 0 leads, proceed to step 2.

### Step 2 — Capture the live DOM

```bash
npm run linkedin:dump-dom -- --keyword "hiring SDR" --max-cards 10
```

Open the `_report.txt` file. The `Status` line at the top tells you which selector groups failed.

### Step 3 — Fix selectors using Claude Code

Paste either the `_report.txt` content or the `_cards.html` file into Claude Code and say:

```
Update LINKEDIN_SELECTORS in src/adapters/linkedin/linkedin-selectors.config.ts
based on this HTML — keep the same interface shape.
```

Claude Code will look at the actual class names and data attributes in the captured HTML and suggest updated CSS selectors.

### Step 4 — Apply and rebuild

After updating `linkedin-selectors.config.ts`:

1. Add new selectors at the **top** of each array so they are tried first; keep old ones as lower-priority fallbacks.
2. Rebuild:
   ```bash
   npm run build
   ```

### Step 5 — Verify

```bash
npm run linkedin:test-live -- --keyword "hiring SDR" --max-results 5
```

Confirm that leads are returned and the `headline`, `content`, and `sourceUrl` fields are populated.

### Step 6 — Update `lastVerified`

Once the adapter is working, update the metadata fields at the top of `linkedin-selectors.config.ts`:

```ts
export const LINKEDIN_SELECTORS: LinkedInSelectors = {
  lastVerified: '2026-04-15',   // today's date
  version: 4,                   // bump by 1
  ...
```

---

## Selector architecture

All CSS selectors live in a single file:

```
src/adapters/linkedin/linkedin-selectors.config.ts
```

Every field that holds an array is a **fallback chain** — the adapter tries selectors in order and uses the first one that returns a match. This means:

- Add new selectors at the **top** of the array (highest priority).
- Leave old selectors at the bottom as fallbacks in case LinkedIn A/B tests the old structure on some accounts.
- Never remove a selector that was previously active without confirming it is fully gone.

### Selector groups and what they extract

| Group | Config key | Extracts |
|-------|-----------|---------|
| Post containers | `postContainers` | The wrapper element for each feed card |
| Author name | `authorName` | Person's display name |
| Author link | `authorLink` | `/in/profile-slug` href |
| Author image link | `authorImageLink` | Fallback name from `aria-label` |
| Content | `content` | Post body text |
| Headline | `headline` | Job title / subtitle under the name |
| Posted-at | `postedAt` | `<time datetime="...">` or text timestamp |
| Session valid | `sessionValid` | Confirms the account is still logged in |
| CAPTCHA detection | `captchaDetection` | Detects soft-block challenge overlays |

---

## Stealth and session behaviour

- The adapter uses `playwright-extra` with `puppeteer-extra-plugin-stealth` to suppress automation signals.
- Browser state (cookies, localStorage, IndexedDB) persists across runs in `data/linkedin-profile/` (configurable via `LINKEDIN_USER_DATA_DIR`). LinkedIn sees the same "device" on every run, which reduces challenge frequency.
- Set `LINKEDIN_HEADLESS=false` to watch the browser during debugging. This is especially useful when diagnosing login failures or CAPTCHA challenges.
- The adapter introduces random mouse movements and scroll delays to mimic human behaviour.

---

## Common failure modes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `0 lead(s)` returned | Selector drift | Run `dump-dom`, fix selectors |
| `linkedin reachable: false` | Network / firewall / proxy | Check connectivity; set `LINKEDIN_PROXY_LIST` |
| Exits immediately after "Logging in" | Saved session is invalid | Delete `data/linkedin-profile/` and re-run |
| `CAPTCHA / checkpoint detected` | Rate limit or suspicious activity | Wait 24 h; use `LINKEDIN_HEADLESS=false` to solve manually; use a proxy |
| `LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set` | Missing env vars | Create / check `.env.local` |
| `Failed to load puppeteer-extra-plugin-stealth` | Missing npm package | `npm install` |
| Leads have empty `name` or `headline` | `authorName` / `headline` selectors broken | Run `dump-dom`, update those selector groups |

---

## Quick reference

```bash
# See all options
npm run linkedin:test-live -- --help
npm run linkedin:dump-dom -- --help

# Full cycle when selectors break
npm run linkedin:dump-dom -- --keyword "hiring SDR" --max-cards 10
# → paste _report.txt into Claude Code, update linkedin-selectors.config.ts
npm run build
npm run linkedin:test-live -- --keyword "hiring SDR" --max-results 5
# → bump version and lastVerified in linkedin-selectors.config.ts
```
