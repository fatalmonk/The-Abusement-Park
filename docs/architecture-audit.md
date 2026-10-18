# Architecture Audit

## Scope and baseline

Audit date: 2026-10-18  
Repository: `fatalmonk/The-Abusement-Park`  
Branch audited: `main` at `c9b768d`  
Production: <https://the-abusement-park.pages.dev/>  
FPL league: `113546`

This is a Phase 0, read-only assessment of the tracked repository and the live Cloudflare Pages deployment. No application behavior was changed.

### Verified architecture

- A single static document contains the page markup, all CSS, historical data, calculations, and browser behavior: `index.html:1-1568`.
- A Cloudflare Pages Function serves `GET /api/standings`: `functions/api/standings.js:122-196`.
- `_routes.json` limits Functions execution to `/api/*`: `_routes.json:1-5`.
- Wrangler serves the repository root as the Pages output directory: `wrangler.jsonc:1-6`.
- The historical archive contains 18 seasons from 2008/09 through 2025/26: `index.html:862-881`.
- The live API aggregates classic-league standings, bootstrap events, and each manager's history: `functions/api/standings.js:1-4,82-119,133-185`.
- A separate GitHub Actions workflow deploys the repository as static GitHub Pages content: `.github/workflows/static.yml:1-43`.
- No package manifest, lockfile, test runner, lint configuration, or application tests are tracked.

## Runtime evidence

The following checks were executed against the audited commit:

- `git status --short --branch`: clean `main`, aligned with `origin/main` before the audit branch was created.
- Inline JavaScript syntax check: passed with Node.js 22.22.3.
- `git diff --check`: passed.
- `git fsck --full`: no corrupt objects; only unreachable/dangling development objects were reported.
- `npx wrangler pages dev . --port 8788`: compiled and served successfully with Wrangler 4.151.1.
- Local `/`: HTTP 200.
- Local `/api/standings`: HTTP 200; returned 26 standings rows, 26 manager-metric records, and the expected metadata keys.
- Production `/`: HTTP 200.
- Production `/api/standings`: HTTP 200 with `Cache-Control: public, max-age=120` and `X-FPL-Cache: MISS`.
- Two consecutive production API probes from the same audit session both returned `MISS`; this is an observed result requiring cache instrumentation, not proof that every edge request misses.
- Static production content rendered the live standings and historical sections in extracted page output.
- Full interactive browser inspection was not completed because the configured remote browser service failed and the local Chrome profile was locked by a running Chrome process. Browser behavior not directly exercised is identified as pending in the testing strategy.

## System flow

1. The browser loads static `index.html` and externally hosted fonts/html2canvas (`index.html:19-22`).
2. `init()` immediately renders historical views and requests `./api/standings` (`index.html:1531-1565`).
3. The Pages Function checks `caches.default` using a canonical `/api/standings` key (`functions/api/standings.js:122-131`).
4. On a miss, it requests classic-league standings (`functions/api/standings.js:133-167`).
5. It requests bootstrap event metadata (`functions/api/standings.js:169-175`).
6. It starts one manager-history request per unique league entry with unbounded `Promise.all()` (`functions/api/standings.js:82-117`).
7. It returns the raw league payload plus computed manager metrics and freshness metadata, then writes the aggregate response to edge cache (`functions/api/standings.js:177-195`).
8. The browser merges API data with a manually maintained current-player table before rendering (`index.html:890-911,1431-1496`).

## Findings

### P0 — Performance risk: unbounded fan-out on cache misses

`buildManagerMetrics()` starts every manager-history request simultaneously (`functions/api/standings.js:82-117`). The audited live league returned 26 entries, so one aggregate miss can cause approximately 28 upstream calls: standings, bootstrap, and 26 histories. A larger league scales linearly. Partial history failures are absorbed, but there is no concurrency limit, timeout, or request budget.

Correction: add a bounded worker pool, per-request abort timeout, and tests proving the concurrency ceiling and partial-failure behavior.

### P0 — Verified defect: the production path lacks an automated quality gate

The only tracked workflow uploads the entire repository directly to GitHub Pages; it runs no syntax, unit, contract, accessibility, or smoke tests (`.github/workflows/static.yml:24-43`). No test files or test tooling are tracked. Production changes can therefore reach deployment without automated regression detection.

Correction: make validation independent of deployment, then require it before either hosting target can publish.

### P0 — Architectural limitation: two deployment models have different capabilities

The documented production architecture requires Cloudflare Pages Functions (`README.md:33-54`), but the GitHub workflow publishes static files only (`.github/workflows/static.yml:35-43`). The GitHub Pages copy cannot execute `functions/api/standings.js`, so its live API path cannot be equivalent to Cloudflare production.

Correction: designate Cloudflare Pages as canonical production. Either remove the GitHub Pages deploy, convert it to validation-only CI, or explicitly document it as a historical/static fallback with live standings disabled.

### P0 — Performance and resilience risk: no upstream timeouts

All FPL requests use plain `fetch()` without an `AbortSignal` (`functions/api/standings.js:18-23,92,135-137`). A slow upstream can consume the Function execution window and delay every uncached visitor.

Correction: implement explicit timeouts and classify timeout, non-2xx, invalid JSON, and invalid schema failures separately.

### P0 — Resilience limitation: no stale-on-error path

The aggregate is cached for 120 seconds (`functions/api/standings.js:5,188-194`). After expiry, a standings fetch failure immediately returns 502 (`functions/api/standings.js:133-166`) even if a recently successful representation existed. Manager-level failures silently become null metrics (`functions/api/standings.js:90-116`).

Correction: retain last-known-good data longer than the freshness TTL, return freshness/degradation metadata, and never label stale values as current.

### P1 — Architectural limitation: cache invalidation and freshness are all-or-nothing

Standings, event schedule, and all manager histories share one 120-second aggregate cache (`functions/api/standings.js:5,122-131,179-195`). These data types have different change rates and failure modes. The current design forces every aggregate miss to recompute every history.

Correction: cache manager histories independently with a longer TTL, keep live standings on a short TTL, and cache bootstrap/event metadata separately. Preserve the aggregate endpoint for backward compatibility.

### P1 — Improvement opportunity: cache behavior needs observability

The response exposes only `X-FPL-Cache: HIT|MISS` (`functions/api/standings.js:127-130,188-191`). Two consecutive production probes returned `MISS`, so cache effectiveness cannot be assumed from implementation alone. Cloudflare documents that Cache API contents are data-center-local, which also limits interpretation across locations.

Correction: log request duration, upstream call counts, history success/failure totals, colo, cache outcome, and data age. Add a deterministic cache test around a mocked cache and an optional production smoke probe.

Reference: <https://developers.cloudflare.com/workers/runtime-apis/cache/>

### P1 — Verified defect: manually maintained live-manager metadata overrides fresh API metrics

`CURRENT_LEAGUE_PLAYERS` duplicates names, team labels, entry IDs, and career values (`index.html:890-910`). During live rendering, its values take precedence over metrics returned by the API (`index.html:1447-1457,1465-1475`). The data can therefore remain stale even when the server has newer history.

Correction: use FPL entry ID as the canonical live identity and prefer validated server metrics. Keep only explicit historical aliases/mappings in maintained data.

### P1 — Data integrity risk: historical identity is name-based

Historical champions are keyed by display-name strings (`index.html:862-881`), while current FPL profiles are connected using normalized names and aliases (`index.html:934-963`). Renames, spelling variants, duplicate names, or recycled entries can misattribute records.

Correction: introduce a reviewed manager registry with an internal stable ID, current FPL entry ID(s), display name, aliases, and historical evidence. Do not auto-merge uncertain identities.

### P1 — Security risk: third-party executable script has no integrity pin or local fallback

`html2canvas` executes from cdnjs without an `integrity` attribute (`index.html:22`). The response headers observed on production include `X-Content-Type-Options` and `Referrer-Policy`, but no Content Security Policy was observed.

Correction: vendor or bundle the dependency, or add Subresource Integrity and a restrictive CSP after testing required font/image/script origins. Do not introduce CSP in the refactor without a report-only validation pass.

### P1 — Architectural limitation: response validation is shallow

The Function validates that two top-level fields are arrays (`functions/api/standings.js:162-167`) but does not validate row types, IDs, ranks, history values, events, or output shape. The client assumes nested properties exist (`index.html:1447-1483`).

Correction: validate and normalize upstream payloads at the boundary. Reject structurally invalid mandatory standings while degrading optional fields to null with explicit status metadata.

### P1 — Verified defect: 10 archive image paths have no tracked image

The 18-season data references `images/2009.png` through `images/2026.png` (`index.html:862-881`), while only 2016, 2018, 2020, and 2022-2026 are tracked. Missing years: 2009-2015, 2017, 2019, and 2021. The modal has an explicit unavailable state (`index.html:1228-1245`), so this is handled but incomplete archive content rather than a crash.

Correction: either source and verify the missing screenshots or mark availability in data and render non-image archive cards without attempting a failed request.

### P1 — Maintainability limitation: application boundaries are absent

`index.html` is 1,568 lines and combines document structure, roughly 700 lines of styles, mutable datasets, calculations, rendering, networking, and interactions. Representative boundaries are `index.html:23-746` (styles), `index.html:852-919` (data/config), and `index.html:920-1565` (logic).

Correction: extract files by stable responsibility without changing the platform or visual behavior. Keep a no-build or minimal-build path until tests demonstrate parity.

### P2 — Repository hygiene: example agent configuration is tracked as production content

`.continue/agents/new-config.yaml:1-23` and `.continue/mcpServers/new-mcp-server.yaml:1-10` are templates, including a placeholder MCP command. The GitHub Pages workflow uploads the repository root (`.github/workflows/static.yml:35-40`), so non-site files can enter deployment artifacts.

Correction: remove unused templates or document their purpose, and deploy from an explicit output directory.

### P2 — Performance opportunity: image payloads are not optimized

Tracked assets total about 4.14 MB; the social image is about 1.37 MB and the 2026 archive image about 643 KB. Archive images are loaded only inside the modal, which limits initial transfer, but social/archive assets can still be compressed and supplied with intrinsic dimensions where rendered.

## Accessibility observations from source

Positive implementation details:

- The page declares `lang="en"` and a viewport (`index.html:2-5`).
- Reduced-motion preferences are respected (`index.html:541-548`).
- Filter controls use tab roles and selected state (`index.html:777-782,1166-1175`).
- Archive cards are keyboard activatable (`index.html:1321-1342`).
- The modal restores invoking focus and supports Escape/arrow navigation (`index.html:1247-1275`).

Risks requiring browser/assistive-technology validation:

- The modal does not implement a focus trap; keyboard focus can escape an open modal (`index.html:1247-1275`).
- The custom tablist updates selection but does not implement arrow-key navigation or roving `tabindex` (`index.html:1166-1175,1556-1559`).
- Standings are visually tabular but use generic `div` elements (`index.html:822-829,1383-1402`), reducing structural navigation for screen-reader users.
- Dynamic loading, success, and failure text is not in an `aria-live` region (`index.html:766-775,1431-1496`).
- Touch-target size, contrast, zoom/reflow, focus order, and screen-reader announcements remain unverified because a complete interactive browser audit was blocked.

## Architecture decision

Retain Cloudflare Pages and Pages Functions. No evidence supports a framework or database migration in the foundation stage. The first implementation work should create regression protection, separate concerns, and harden upstream access while preserving URLs and payload compatibility.
