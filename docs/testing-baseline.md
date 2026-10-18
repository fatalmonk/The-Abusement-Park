# Testing Baseline

## Repository verification and implementation checklist

Verified against `origin/main` at merge commit `9ba7965` before implementation:

- [x] Phase 0 audit documents are present on `main`.
- [x] Historical records remain embedded in `index.html`; no records changed.
- [x] `/api/standings` remains a Cloudflare Pages Function with the existing response contract.
- [x] Existing GitHub Pages workflow remains present and unchanged.
- [x] Add deterministic unit coverage for historical calculations.
- [x] Characterize current FPL API success, failure, cache, and method behavior.
- [x] Add DOM regression coverage without redesigning application behavior.
- [x] Serve the real site through Wrangler for browser tests.
- [x] Mock external FPL responses in browser tests.
- [x] Add accessibility baseline and CI-only validation workflow.
- [x] Add reproducible local commands, coverage thresholds, and documentation.

The Phase 0 findings matched the inspected implementation. One qualification remains: repeated production `MISS` headers characterize observed cache behavior but do not prove the cache implementation itself is defective.

## Test architecture

- Vitest runs unit, API contract, and jsdom interaction tests.
- The historical test helper evaluates the existing inline application functions without moving or rewriting production algorithms.
- API tests import the Pages Function directly and replace `fetch` and `caches.default` with deterministic test doubles.
- Playwright starts the full application with `wrangler pages dev .` and intercepts `/api/standings` in-browser.
- axe-core runs inside every required browser viewport.
- ESLint, Markdownlint, inline JavaScript syntax validation, and static asset/structure validation provide pre-test quality gates.

## Test inventory

Historical regression coverage includes title totals, last-five and last-ten filters, current and longest streaks, runner-up/Chief Bottler output, never-won classification, droughts, seasons since last championship, comeback calculations, deterministic tie order, empty and single-season helper inputs, missing runner-up data, and normalized duplicate names.

API coverage includes success, empty standings, cache HIT/MISS, missing bootstrap data, missing or failed manager history, network failure, non-2xx responses, invalid JSON, invalid mandatory structures, malformed manager records, response shape stability, cache headers, and 405/Allow behavior.

DOM and browser coverage includes dashboard rendering, filters, podium, leaderboard, archive cards, missing screenshots, live loading/success/unavailable states, profile links, expand/collapse, dialog keyboard behavior, focus restoration, JavaScript exceptions, and horizontal overflow.

## Fixture design

Fixtures under `tests/fixtures/` use invented names, small records, fixed timestamps, and controlled clocks. CI never calls the public FPL API and does not assert volatile gameweek, rank, deadline, or manager-count values.

The approved historical records are intentionally read from `index.html` so tests lock the currently shipped dataset without duplicating or silently correcting it.

## Coverage baseline

The mandatory threshold covers `functions/api/standings.js`:

- Statements: 85%
- Branches: 70%
- Functions: 85%
- Lines: 85%

The initial verified run exceeded each threshold. Inline historical code is protected by direct behavioral regression tests, but is not included in V8 file coverage because it remains embedded in HTML.

## Accessibility baseline

Automated axe checks run at 320 × 568, 390 × 844, 768 × 1024, and 1440 × 900. Automated checks do not establish WCAG 2.2 AA compliance.

Existing finding, narrowly baselined:

- `label-content-name-mismatch` on season archive cards. Each card's `aria-label` includes the full winner name while the visible card includes only the winner's first name. This is an existing serious axe finding and is deferred to the accessibility implementation PR.

Every axe result is attached to the corresponding Playwright test result. All other critical or serious violations fail the suite. No broad rule suppression is used.

## Known existing defects and limitations

- Several historical screenshots are absent; the tested modal error state is intentional characterization.
- The application script and historical data remain monolithic and inline.
- Historical name identity remains string-based.
- Some manager metrics remain manually maintained in the frontend.
- The current Function has no upstream timeout, concurrency limit, or stale-on-error strategy. Those changes are reserved for PR 3.
- Month display derives from the current calendar date; tests avoid volatile assertions around that label.
- GitHub Pages can host the static page but cannot execute the Cloudflare Pages Function. The existing deployment workflow is preserved pending an explicit hosting decision.
- Manual screen-reader, zoom/reflow, and complete keyboard audits remain necessary.

## Remaining testing gaps

- No visual-regression image baseline.
- No live-production FPL probe in CI by design.
- No performance budget or synthetic monitoring.
- No browser matrix beyond Chromium in this foundation PR.
- The current UI has no live metric-selection control, so no behavior was invented for one.

## Recommended PR 2 prerequisites

PR 2 can proceed once this workflow is required for pull requests to `main`. Keep historical changes separate, use these regression tests to prove equivalence, and resolve the documented archive-card accessible-name issue in the dedicated accessibility scope. API resilience and cache architecture should remain in PR 3.
