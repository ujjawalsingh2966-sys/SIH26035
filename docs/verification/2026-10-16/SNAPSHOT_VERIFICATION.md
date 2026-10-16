# Local snapshot verification — 16 October 2026

Fresh checks were run for the documentation/commit/push snapshot in the existing SIH26035 checkout. Business registration/login is **implemented for the account-only prototype slice**; the wider application/inspection/certificate workflow is not complete. The Business application-form scenario remains **BLOCKED**.

The work branch is `work/local-lab-business-snapshot-20261016`, based on local `main` at `c3eac34`. Remote destination was checked as `https://github.com/dinamsingh/SIH26035.git`; read-only `git ls-remote --heads origin` confirmed authentication/connectivity and remote `main` at `a72f79f`. The work branch preserves the local source baseline; it does not merge the nine later commits on remote main or import their entire prototype. Push completion is reported separately from validation.

## Fresh results

| Check | Result |
| --- | --- |
| Backend complete suite | **201 PASS / 14 suites**, exit 0 |
| Backend TypeScript build | PASS, exit 0 |
| Frontend no-emit TypeScript check | PASS, exit 0 |
| Frontend production build, including existing lint/type checks | PASS, exit 0 |
| Business account Chromium runner | **15 PASS / 0 FAIL / 1 BLOCKED**, exit 0 |
| Existing full laboratory Chromium runner | **36 PASS / 0 FAIL / 1 BLOCKED**, exit 0 |
| Existing instrument submission/retry Chromium runner | **9 PASS / 0 FAIL**, exit 0 |
| Browser scripts' syntax and Git whitespace checks | PASS |

Tooling: Node **24.21.0**, npm **11.19.0**, Next **14.2.35**, React **18.3.1**, TypeScript **5.9.3**, Jest **29.7.0**, Playwright **1.64.1**, Chromium **156.0.8078.4**. These are installed/lockfile versions from this local run; they are not a statement that upstream packages or external standards have been freshly researched.

Frontend **http://127.0.0.1:3013** targeted backend **http://127.0.0.1:4004**, using the separate `.next-snapshot-review` build cache and fresh `artifacts/browser-review/publish-snapshot-20261016/data`. Existing services/datasets were preserved. Jest selected OS temporary storage. Browser checks verified the served isolated data and preserved original project JSON hashes. Only synthetic records were created.

The Business runner checked associated labels, registration, real invalid/duplicate/privileged-role/staff-collision responses, hashed persisted accounts, single-request/single-record rapid submission, account reload, logout, wrong-password handling, second-account isolation, mobile staff-route denial and protected API/report denial. Light/dark heading contrast measured **17.85:1 / 16.30:1**. It intentionally aborted one outgoing registration before forwarding and delayed another real request; successful responses were never mocked.

The laboratory runner exercised real technician → review → correction → resubmission → approval, Administrator approval, evidence, stale revisions, history/locks, report download/content/authorization, form labels/contrast and role navigation. The focused submission runner additionally verified confirmed rejection retry, reuse of a saved instrument after downstream failure, independent legitimate creation and suppression of retries after an ambiguous real save. These tests establish UI request protection, **not general backend idempotency**.

No browser JavaScript exceptions were reported. Expected console/network failures from deliberate validation, denial and offline/delivery tests were retained in local raw evidence. The known application-route 404 is represented as BLOCKED workflow coverage, not a passed application submission.

During publication hygiene, removing password values from a setup document exposed a bug in the newly added fixture loader: an initially broad source regex matched a type check rather than the demo-password comparison. One backend attempt therefore reported 200 PASS / 1 FAIL. The loader was anchored correctly, duplicated new-test credential literals were removed, and the final complete suite passed **201/201**. No application permissions or assertions were relaxed. The frontend build also emitted the existing non-blocking informational warning about adding the Next TypeScript plugin to an extending config.

## Selected publishable evidence

Only a field-whitelisted subset of this run is included in Git:

- [Laboratory scenario results](laboratory-results.json): 37 entries, including the retained BLOCKED scenario.
- [Business account scenario results and contrast](business-accounts-results.json): account coverage plus the separate BLOCKED workflow.
- [Instrument submission results and numeric request/persistence counts](instrument-submission-results.json).
- [Aggregated network response-status evidence](network-status-summary.json): no headers, bodies, queries, account details or record snapshots.
- [Reports navigation](reports-navigation.png), [populated mobile registration](business-registration-dark-mobile.png), [mobile Business account](business-account-dark-mobile.png).

All three screenshots were visually inspected before inclusion. Login/account fields and identities are masked. The report screenshot contains only the runner's synthetic instrument/test fixture, not project user records. The selected set is approximately 0.9 MB; bulk screenshots, PDFs, account/persistence files, raw console/network logs, traces and old attempts remain local under ignored artifacts. Historical reports' links into that local directory are intentionally not published files; this page supplies repository-relative evidence links that work on GitHub.

## Commands actually run

From the repository root (PowerShell uses `npm.cmd`):

```powershell
npm.cmd run test --workspace backend -- --runInBand --silent --coverageReporters=text-summary --coverageReporters=json
npm.cmd run build --workspace backend
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4004'
$env:W8LAB_BROWSER_BUILD_DIR='.next-snapshot-review'
npm.cmd run build --workspace frontend
node --version
npm.cmd --version
npm.cmd ls --depth=0
```

Fresh backend, after creating the new directory:

```powershell
$env:PORT='4004'
$env:CLIENT_URL='http://127.0.0.1:3013'
$env:DATA_DIR=Join-Path (Get-Location) 'artifacts/browser-review/publish-snapshot-20261016/data'
$env:NODE_ENV='development'
node backend/dist/index.js
```

Frontend in another terminal, using the build environment above:

```powershell
npm.cmd run start --workspace frontend -- --hostname 127.0.0.1 --port 3013
```

Browser terminal:

```powershell
. .\e2e\local-staff-env.ps1
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3013'
$env:W8LAB_BROWSER_BACKEND='http://127.0.0.1:4004'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/publish-snapshot-20261016'
node e2e/business-accounts-browser.cjs
node e2e/laboratory-browser.cjs
node e2e/instrument-submission.cjs
git diff --check
git diff --cached --check
```

The raw local output subdirectories are `accounts-2026-10-16T17-55-42-263Z`, `attempt-2026-10-16T17-55-49-455Z` and `submission-2026-10-16T17-56-36-177Z`. They were copied selectively through a field whitelist rather than committing raw saved records. The final backend log is local `backend-tests-final.log` beside those directories.

## Snapshot contents and exclusions

Saved work includes laboratory workflow/state/history fixes, report record authorization and Reports UI, instrument duplicate-submit/retry/contrast/label fixes, reviewer navigation, Business accounts, regression infrastructure, the lockfile, intentional verification config and detailed reports. No unrelated feature was implemented for this snapshot.

The README supplies project context, role policy, architecture/stack, status, local setup/env placeholders, current auth/account setup, commands, results, limits and next priorities. It explicitly distinguishes the additional Business prototype from laboratory/manufacturer model approval, and historical phase-completion statements from current implementation evidence.

The previously tracked `frontend/.env.local` is removed from Git tracking **and preserved on disk**. Environment files, real or test persistence/account data, dependencies, generated builds/coverage, incremental caches and bulk artifacts are excluded. `data/.gitkeep` preserves an empty directory for reproducible fresh-checkout/browser setup. Example environment files contain placeholders. Password values are omitted from publishable setup documentation; local fixture loaders reuse the pre-existing development-only source default without printing it. No private production credentials, JWTs or real user records were selected for the commit.

Current limits remain those in [README](../../../README.md): development staff authentication and browser-local logout, single-writer JSON persistence, limited metrology profile/test completeness, prototype reports, no official signatures/certificates, and absent Business applications/assignments/inspections/QR/renewals. Chromium desktop/narrow testing does not cover Firefox/WebKit, real autofill, assistive technology or deployment. Passing this snapshot's checks does not complete the entire project.
