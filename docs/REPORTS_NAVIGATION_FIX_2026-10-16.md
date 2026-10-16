# Reports navigation and browser workflow — 2026-10-16

Publication note: raw browser artifacts linked below are retained locally and excluded from Git. See the [published verification summary](verification/2026-10-16/SNAPSHOT_VERIFICATION.md) for selected redacted evidence and fresh snapshot checks. Account-import snippets now use the local demo environment loader instead of publishing passwords.

Fixed locally in the existing SIH26035 checkout on `main`, preserving previous uncommitted work, test infrastructure, records and artifacts. No applicable AGENTS.md was found in the repository or ancestor chain. Nothing was cloned, pulled, reset, stashed, committed, pushed, merged or deployed.

**Working URL: http://127.0.0.1:3011/reports** (local backend: **http://127.0.0.1:4002**).

## Root cause and chosen fix

The sidebar URL `/reports` was correct, but no frontend Reports route/index existed. There was no suitable report screen to redirect to, and this was not an authentication redirect or folder-name mismatch. Real Chromium Reviewer login reproduced HTTP **404** through both the sidebar and direct refresh. The existing authorized repository search returned approved rows successfully, with no audit/record changes. [Before proof](../artifacts/browser-review/reports-index-20261016/reproduction/before-2026-10-16T16-49-08-912Z/results.json), [404 screenshot](../artifacts/browser-review/reports-index-20261016/reproduction/before-2026-10-16T16-49-08-912Z/reports-404-sidebar.png).

The minimal intended behavior was established by `docs/phase-3/INFORMATION_ARCHITECTURE.md` (Reports maps approved evaluations to PDFs), phase-10 reporting documentation, phase-11 repository documentation and the implementation baseline. `ReportService` accepts only **APPROVED** cases. `RepositoryService.search` already filters records through `userHasAccess` on the backend before joins, search, totals and pagination. Existing data/HTML/PDF endpoints use the shared record guard before generation.

The new index therefore uses `GET /api/v1/repository/search?status=APPROVED`, with existing search/pagination, then the existing authenticated HTML/PDF endpoints on explicit clicks. Opening, searching or refreshing the list calls no report generator and changes no state/audit records. The index shows only backend-authorized rows; privacy does not depend on client-side filtering.

Owning Technician, Reviewer and Administrator access follows the existing shared backend policy and previously authorized/tested report-access baseline. Approval authority and report eligibility were not changed. Older SRS wording about Administrator report generation was not used to alter the established access that the user instructed this task to preserve. Early conceptual draft previews were not added: the actual approved-only final-report rule remains authoritative for this fix. No new eligibility decision was needed.

## Changed files

- New `frontend/app/(dashboard)/reports/page.tsx`: approved report list with persistent search label, backend pagination, sandboxed read-only HTML preview, authenticated PDF download and saved-record link. Distinct loading, empty, request-error and access-denied states; visible failure feedback and retry. It reuses the existing authenticated session context. Account/role identity keys, request aborts and token checks clear old rows/previews and prevent late prior-account responses from appearing or downloading. A synchronous action guard prevents overlapping preview/download requests.
- `frontend/app/(dashboard)/layout.tsx`: adds a small **Reports** entry to the existing narrow header, pointing to the same route. Desktop sidebar routing is unchanged. No unrelated mobile menu implementation was added.
- New `backend/tests/reportListing.test.ts`: nine meaningful regressions for the existing listing endpoint: owner/unrelated-technician/Reviewer/Administrator visibility, targeted-query privacy, authorized pagination/totals, authentication/role denial and no generation/audit/state changes during listing. **No backend production source changed.** Existing report guards and generators remain intact.
- New `e2e/reports-browser.cjs`: focused real-browser coverage, supported API fixture setup and a read-only pre-fix inspection mode.
- `e2e/laboratory-browser.cjs`: retains the original Reports 404 assertion and all report-authorization assertions. Its PDF scenario now clicks the product Reports UI instead of inserting a browser-side fetch helper. The same PDF content, saved-state and actual Chromium PDF viewer assertions remain.
- This report. No dependency, authentication architecture, storage technology, formula, report content/template or certificate-permission changes.

## Actual verification results

| Check | Result |
| --- | --- |
| Focused backend report listing + existing authorization tests | **53/53 PASS**, 2 suites, exit 0 |
| Complete backend suite | **154/154 PASS**, 13 suites, exit 0 |
| Backend build | PASS, exit 0 |
| Frontend standalone typecheck | PASS, exit 0 |
| Frontend production build | PASS, exit 0; all 10 pages generated, including `/reports` |
| Focused real-browser Reports suite | **13 PASS**, exit 0 |
| Full browser runner, once after fix | **36 PASS / 0 FAIL / 1 BLOCKED**, exit 0 |
| Browser runner syntax / `git diff --check` | PASS |

Previous full browser result was 35 / 1 / 1. The single prior failure, Reports navigation, now passes. Browser success is not a claim that the entire project is complete: the business application route remains absent and blocked.

Browser/tooling: Playwright **1.64.1**, actual full Chromium **156.0.8078.4**, headless, including Chromium's PDF viewer. All successful login, listing, approval fixture, preview and download responses came from the real local backend. Original project JSON inventory/hashes were preserved. Credentials were imported at runtime from the existing local development account guide; account identifiers/login inputs were masked, with no tokens/Authorization headers in telemetry.

## Focused browser scenarios and evidence

Authoritative run: [results and fixture IDs](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/results.json), [network](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/network.json), [console](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/console.json).

| Scenario | Result |
| --- | --- |
| Real delayed listing: loading → empty; no generation/audit changes | PASS |
| Supported setup: two distinct technicians' approved cases and an ineligible draft | PASS |
| Owner list, direct route, refresh and search; authorized rows only, no generation | PASS |
| Owner HTML preview and rapid-click PDF download; one request, contents match saved evaluation | PASS |
| Unrelated Technician list contains only own report; targeted search empty; other record data/HTML/PDF all 403 | PASS |
| Reviewer and Administrator list permitted approved records and preview/download | PASS |
| Narrow Reports header entry, light/dark themes, no horizontal page clipping | PASS |
| Offline request error clears rows, shows retry and recovers | PASS |
| Real 401 response gives distinct access-denied state and recovers | PASS |
| Real denied PDF gives feedback, no download/audit; allowed retry succeeds | PASS |
| Cross-tab account switch clears preview/list; delayed previous-account response cannot restore rows | PASS |
| Real pagination: owning Technician total 21 approved reports, 20/1 across pages, excludes other Technician | PASS |
| Anonymous listing and protected PDF remain 401 | PASS |

Fixture setup used real authenticated browser API calls through existing transitions, including evaluated Class III readings L=5000 g, I=5000 g, ΔL=2.5 g, E0=0 g. Saved Ec=0 g, MPE=5 g, PASS. No thresholds/validation were weakened, and no records were directly edited to become approved. Additional pagination cases reused the supported existing-instrument case API and were approved through the same workflow. Test storage remained isolated.

Negative/slow probes were explicit: delay/continue a real list request; Chromium offline mode; replace an outgoing list token with an invalid synthetic token to obtain the backend's real 401; redirect a PDF request to the other protected record with the real unrelated Technician token to obtain a real 403; hold a real prior-account list response across a real second-tab login. No successful response was fabricated. Expected 401/403/offline console errors are retained; there were zero application page errors.

Useful screenshots/downloads:

- [Owner authorized list](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/owner-authorized-report-list.png), [HTML preview](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/owner-html-preview.png).
- [Downloaded owner PDF](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/owner-report.pdf), [opened in actual Chromium PDF viewer](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/owner-pdf-open-in-chromium.png).
- [Mobile light](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/reports-mobile-light.png), [mobile dark](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/reports-mobile-dark.png).
- [Loading](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/reports-loading.png), [empty](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/reports-empty.png), [request failure](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/reports-request-error.png), [access denied](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/reports-access-denied.png).
- [Unrelated Technician's own list](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/unrelated-technician-only-own-list.png), [PDF denial feedback](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/pdf-access-denied-feedback.png), [account change with no stale rows](../artifacts/browser-review/reports-index-20261016/focused/reports-2026-10-16T16-56-21-331Z/reports-account-change-no-stale-rows.png).

Full-run evidence: [results](../artifacts/browser-review/reports-index-20261016/full/attempt-2026-10-16T17-00-31-073Z/results.json), [network](../artifacts/browser-review/reports-index-20261016/full/attempt-2026-10-16T17-00-31-073Z/network.json), [console](../artifacts/browser-review/reports-index-20261016/full/attempt-2026-10-16T17-00-31-073Z/console.json), [working Reports navigation](../artifacts/browser-review/reports-index-20261016/full/attempt-2026-10-16T17-00-31-073Z/report-navigation.png), [PDF downloaded through Reports UI](../artifacts/browser-review/reports-index-20261016/full/attempt-2026-10-16T17-00-31-073Z/approved-report.pdf), [PDF opened in Chromium](../artifacts/browser-review/reports-index-20261016/full/attempt-2026-10-16T17-00-31-073Z/approved-report-open-in-browser.png), [unchanged cross-record denial assertions](../artifacts/browser-review/reports-index-20261016/full/attempt-2026-10-16T17-00-31-073Z/cross-record-report-probe.json).

The full runner also passed correction → resubmission → Reviewer approval, Administrator approval, reload/history/locks, rapid instrument submission, persistent labels, contrast and reviewer navigation. It ran once after the change. The original 404 and report-access assertions were not weakened.

## Exact commands and local isolation

The previously isolated 3011/4002 services were verified before reuse. Reproduction matched served approved IDs against `artifacts/browser-review/instrument-navigation-20261016/full/data`. Only task-owned isolated services were stopped/restarted for fresh focused/full storage and the frontend production build. Other services, their caches and previous records were preserved.

Backend, using `focused\data` for the focused runner and fresh `full\data` for the full runner:

```powershell
$env:PORT='4002'
$env:CLIENT_URL='http://127.0.0.1:3011'
$env:DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\reports-index-20261016\full\data'
npm.cmd run dev --workspace backend
```

Frontend in another terminal:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_BUILD_DIR='.next-contrast-review'
npm.cmd run dev --workspace frontend -- --hostname 127.0.0.1 --port 3011
```

Accounts were imported without logging their values:

```powershell
. .\e2e\local-staff-env.ps1
```

Browser commands:

```powershell
# Before editing, existing verified services/storage.
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\reports-index-20261016\reproduction'
$env:W8LAB_BROWSER_DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-navigation-20261016\full\data'
node e2e/reports-browser.cjs --inspect

# After editing, with this task's focused backend storage.
$env:W8LAB_BROWSER_DATA_DIR=$null
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3011'
$env:W8LAB_BROWSER_BACKEND='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\reports-index-20261016\focused'
node e2e/reports-browser.cjs

# After restarting only the isolated backend with fresh full\data.
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\reports-index-20261016\full'
node e2e/laboratory-browser.cjs
```

Backend checks:

```powershell
npm.cmd run test --workspace backend -- --runInBand tests/reportAuthorization.test.ts tests/reportListing.test.ts --coverageReporters=text-summary --coverageReporters=json
npm.cmd run test --workspace backend -- --runInBand --coverageReporters=text-summary --coverageReporters=json
npm.cmd run build --workspace backend
```

Frontend checks/build and final validation:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
# Stop only the isolated frontend before building its separate cache.
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_BUILD_DIR='.next-contrast-review'
npm.cmd run build --workspace frontend
node --check e2e/reports-browser.cjs
node --check e2e/laboratory-browser.cjs
git diff --check
```

All commands above completed with exit 0. The existing inherited-TypeScript-plugin informational build warning remained non-blocking. Jest selected temporary isolated storage; no project data was used. Browser services remain running on 3011/4002 with this task's `full/data` directory. For another full run's empty-state expectation, choose a fresh directory instead of deleting existing test records.

## Remaining limitations

- The business application route/form remains **BLOCKED** and was not implemented. Passing these browser scenarios does not establish completion of the entire project or all requirements.
- Existing prototype report content/disclaimer, per-generation report IDs/timestamps and generation audit events are retained. Preview/download are explicit generation requests; this fix does not add a persisted report-artifact/version registry, official template, signatures or certificates.
- Only Chromium desktop and a 390px viewport were exercised. Firefox/WebKit and physical mobile/assistive-technology sessions were not tested. The Reports header link supplies the required narrow entry; the unrelated existing mobile menu icon was not implemented.
- Existing development authentication and backend access/eligibility policies remain unchanged. No production deployment or broader authentication/storage work was performed.

Changes remain local for review.
