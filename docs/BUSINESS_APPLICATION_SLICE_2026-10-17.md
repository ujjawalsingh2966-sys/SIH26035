# W8LAB Business application slice — 17 October 2026

Completed the requested workflow: **Business login → create and submit → own applications/list/details/history**. The actual form has been exercised against the real local backend. The previously blocked application-form scenario now passes; historical reports keep their original results.

## Prerequisites and baseline

- No applicable `AGENTS.md` was found. README, project context, the Business discovery/account reports and the latest snapshot verification were inspected before implementation.
- Git status was inspected and existing uncommitted work was preserved, including the navigation redesign, login/CORS/W8LAB fixes, account foundation and report/workflow protections. No pull, branch change, reset, stash, commit, merge, push or deployment was performed.
- Business registration/password authentication, active-account resolution and role isolation already existed. They were retained and verified using real registration/login responses. The only authentication UI behavior changed for this slice is the Business destination: `/applications`; `/account` remains available.
- The user selected the locally cached Business verification prototype. Read-only inspection of cached ref `9e430db` / `origin/feat/verification-lifecycle`, particularly `VerificationService.ts`, `verificationRoutes.ts`, the application pages and lifecycle tests, supplied the field/state/ownership baseline. Only the initial-application slice was extracted. Broader officer, inspection, certificate and renewal behavior was not restored.
- This workflow is separate from laboratory test cases and manufacturer/Director model approval. No metrology calculation, laboratory lifecycle, storage architecture or existing record owner was migrated.

## Adopted contract

| Input | Validation |
| --- | --- |
| Business name | Trimmed, required, at most 200 characters |
| Installation address | Trimmed, required, at most 1000 characters |
| Instrument name, model, serial number | Trimmed, required, at most 200 characters each |
| Accuracy class | II, III or IIII |
| Max, Min, e, d | Decimal strings in grams, at most 40 characters; Min ≥ 0, Max/e/d > 0, Min < Max, d ≤ e ≤ Max; authoritative backend comparison uses decimal.js |
| Tare device | Required boolean; unchecked means false |
| Supported profile | Weighing, non-automatic/manual intervention, electronic and single-range; backend requires all four booleans true; form requires confirmation |
| Submission key | Required UUID; generated once per form and retained for retry |

The prototype starts a valid application directly in **SUBMITTED**, with type **INITIAL**. It defines no draft or edit-before-submit endpoint for this intake path. Submission generates application/instrument IDs, authenticated owner ID, UTC creation/update times and one `SUBMITTED` history entry attributed to that owner. Business clients cannot set ownership, status, assignment, verdicts, certificates, IDs or history. Unexpected/privileged fields are rejected rather than persisted.

An owner-scoped replay of the same submission key returns the existing application (HTTP 200) without another record/history entry; a new save returns 201. A replay returns the original saved values, never an edit. Repeating the explicit submit transition or attempting to edit a submitted record returns 409. Missing/cross-owner records return the same 404. Anonymous requests return 401; laboratory roles return 403. List and detail authorization are enforced by the backend.

Applications use a separate `applications.json` through the existing `JsonStore` and `DATA_DIR`. Opt-in strict writes use temporary-file replacement and roll back in-memory creation after failed persistence; safe save failures return 503. Laboratory stores keep their prior behavior. The UI preserves entered fields after failures, closes overlapping submissions synchronously, restores retry, and reuses its submission key after an ambiguous response. No database migration was introduced.

## Routes and interface

| Route | Behavior |
| --- | --- |
| `/register` | Existing Business self-registration |
| `/business/login` or Business credentials at `/login` | Real authentication; opens `/applications` |
| `/applications` | Own list/search and labelled create-and-submit form |
| `/applications/[id]` | Own immutable details, units, submission status and history |
| `/account` | Existing account details |
| `GET /api/v1/verification/applications` | Own records only |
| `POST /api/v1/verification/applications` | Validated creation/submission or safe delivery replay |
| `GET /api/v1/verification/applications/:id` | Own detail or 404 |
| `PUT /api/v1/verification/applications/:id` | Owner check, then 409 read-only rejection |
| `POST /api/v1/verification/applications/:id/submit` | Owner check, then 409 already-submitted rejection |

The main local frontend was rebuilt/restarted at **http://127.0.0.1:3014**; its backend is **http://localhost:4000**, health `/api/v1/health`. Isolated browser verification used **http://127.0.0.1:3015** and **http://127.0.0.1:4005**. The isolated services were stopped after verification; main local services remain running. The unrelated listener on port 3000 was not changed.

The installed `emil-design-eng` guidance at `.agents/skills/emil-design-eng/SKILL.md` informed readable hierarchy, existing surface/spacing utilities, persistent labels, focus feedback and restrained motion. The installed navigation `prototype` skill is for explicit visual exploration and was not invoked for this implementation slice.

| Before | After | Why |
| --- | --- | --- |
| Business account-only navigation | Applications and Account; W8LAB home opens Applications for Business | Makes the permitted workflow reachable without laboratory actions |
| No Business application form | Grouped business/site, identity and metrological inputs with persistent labels and explicit grams | Makes technical entry readable on desktop and narrow screens |
| No submission/detail feedback | Loading, empty/search, validation, save failure/retry, immutable detail and history states | Makes outcomes and allowed next actions clear |
| Business form scenario reported BLOCKED | Actual registration/login, form submission, saved detail/reload and staff denial assertions | Coverage now establishes the implemented workflow |

## Actual verification results

| Check | Final result |
| --- | --- |
| Backend Jest/Supertest regression | **223/223 tests**, **16/16 suites**, exit 0 |
| Backend TypeScript build | Passed, exit 0 |
| Frontend TypeScript check | Passed, exit 0 |
| Frontend production build, including lint/type validation | Passed, exit 0; application list/detail routes emitted |
| Focused Business Chromium runner, managed backend | **24 PASS / 0 FAIL / 0 BLOCKED**, exit 0 |
| Full existing laboratory Chromium runner | **37 PASS / 0 FAIL / 0 BLOCKED**, exit 0 |
| Existing focused Reports Chromium regression | **13 PASS / 0 FAIL / 0 BLOCKED**, exit 0 |
| Existing instrument submission/retry Chromium regression | **9 PASS / 0 FAIL / 0 BLOCKED**, exit 0 |
| Existing login/branding Chromium checks on main rebuilt app | All checks passed, exit 0 |
| `git diff --check` | Passed, exit 0 |

Tooling: Playwright **1.64.1**, Chromium **156.0.8078.4**, Next.js **14.2.35**. [Selected redacted scenario metadata](verification/2026-10-17/business-application-results.json) records each final scenario and its raw evidence source. The earlier approval-review usage-limit interruption was resolved on resumption; the full runner subsequently ran to completion.

Business coverage uses two separately registered accounts and verifies actual sign-in destinations, session reload/logout, missing/invalid fields, real server validation, unsupported roles, forged ownership, privileged fields, owner-only listing/details, cross-owner denial, immutable submission, rapid clicks/keyboard submission, readable light/dark narrow layouts, list search/loading/error/retry and JavaScript exceptions. It aborts delivery before saving in one scenario and drops a real committed 201 response in another. Successful retry returns the original application with one history entry. A runner-owned backend is actually stopped and restarted: login shows a genuine connection error during the outage, then succeeds on retry; account/application contents and detail responses survive the restart.

Laboratory coverage includes measurement evaluations, ownership, duplicate submission, reviewer claim, correction, resubmission, approval, stale-revision feedback and authenticated PDF download/content. The Reports suite additionally covers all protected representations, pagination, cross-tab session changes, denied downloads and retry. Original project JSON file hashes were unchanged by the isolated runners. No successful authentication or application response was fabricated. No passwords, tokens, account hashes or saved sessions are included in the published metadata.

During verification, stale exact-case sidebar selectors and a mobile click without opening the navigation drawer caused runner failures. Those interactions were corrected. Loading/failure injections were also updated to cover the active mount request when React development mode cancels/repeats an earlier fetch. Existing authorization, report-content, persistence and workflow assertions were retained. Earlier failed attempts remain under ignored artifacts. Jest's default HTML coverage reporter initially hit its existing Windows source-path issue; the documented text-summary/JSON reporter command below passed without that error, with unchanged tests.

## Exact commands and isolation

From the repository root, the final build/check commands were:

```powershell
npm.cmd test --workspace backend -- --runInBand --coverageReporters=text-summary --coverageReporters=json
npm.cmd run build --workspace backend
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
npm.cmd run build --workspace frontend
git diff --check
```

The backend commands were executed from `backend/` without the equivalent `--workspace backend` flag; the frontend check/build were executed from `frontend/` with their equivalent relative paths. Final coverage: 92.9% statements, 74.56% branches, 93.33% functions and 94.98% lines.

The isolated frontend terminal used:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4005'
$env:W8LAB_BROWSER_BUILD_DIR='.next-business-applications'
npm.cmd run dev --workspace frontend -- --hostname 127.0.0.1 --port 3015
```

The full laboratory runner used a separate empty store, with the backend started in another terminal using `DATA_DIR=<run>/data`, `PORT=4005`, `CLIENT_URL=http://127.0.0.1:3015` and `npm.cmd start --workspace backend`:

```powershell
. .\e2e\local-staff-env.ps1
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3015'
$env:W8LAB_BROWSER_BACKEND='http://127.0.0.1:4005'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/business-applications-20261017-full-final'
node e2e/laboratory-browser.cjs
```

After stopping that isolated backend, the focused Business runner started and controlled only its own child backend:

```powershell
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/business-applications-completion-final-20261017'
New-Item -ItemType Directory -Force -Path (Join-Path $env:W8LAB_BROWSER_RUN_DIR 'data') | Out-Null
$env:W8LAB_BROWSER_MANAGE_BACKEND='1'
node e2e/business-accounts-browser.cjs
```

For Reports/instrument checks, a separately started backend used another new directory `artifacts/browser-review/business-applications-lab-regressions-final-20261017/data` on port 4005. In a browser terminal with the same frontend/backend settings and staff fixture environment:

```powershell
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/business-applications-lab-regressions-final-20261017'
node e2e/reports-browser.cjs
node e2e/instrument-submission.cjs
```

The main app used `npm.cmd start --workspace backend` and `npm.cmd start --workspace frontend -- --hostname 127.0.0.1 --port 3014`. Main login verification used:

```powershell
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3014'
node e2e/login-browser.cjs
```

Choose new empty run directories when repeating suites with empty-state assertions. The managed Business runner refuses an occupied backend health endpoint and stops only its own child; it does not kill arbitrary listeners. The temporary Next cache is ignored, and Next's generated browser-tsconfig include was removed after verification to preserve the original configuration.

## Evidence

- [Business final results](../artifacts/browser-review/business-applications-completion-final-20261017/accounts-2026-10-17T12-13-44-598Z/results.json), with masked [light mobile form](../artifacts/browser-review/business-applications-completion-final-20261017/accounts-2026-10-17T12-13-44-598Z/application-form-light-mobile.png), [dark mobile form](../artifacts/browser-review/business-applications-completion-final-20261017/accounts-2026-10-17T12-13-44-598Z/application-form-dark-mobile.png) and [submitted detail](../artifacts/browser-review/business-applications-completion-final-20261017/accounts-2026-10-17T12-13-44-598Z/application-detail-dark-mobile.png).
- [Full laboratory final results](../artifacts/browser-review/business-applications-20261017-full-final/attempt-2026-10-17T12-10-29-558Z/results.json), with the actual Business form scenario and report checks.
- [Reports final results](../artifacts/browser-review/business-applications-lab-regressions-final-20261017/reports-2026-10-17T12-16-46-520Z/results.json) and [instrument retry final results](../artifacts/browser-review/business-applications-lab-regressions-final-20261017/submission-2026-10-17T12-17-38-180Z/results.json).
- [Main login results](../artifacts/browser-review/login-20261017/results.json).

Raw artifacts are local and ignored. The selected scenario metadata above is portable and excludes private fixture data.

## Files changed for this slice

- Backend: `backend/src/app.ts`, `backend/src/routes/businessApplicationRoutes.ts`, `backend/src/services/BusinessApplicationService.ts`, `backend/src/repositories/JsonStore.ts`, `backend/tests/businessApplications.test.ts`.
- Frontend: `frontend/app/(dashboard)/applications/page.tsx`, `frontend/app/(dashboard)/applications/[id]/page.tsx`, `frontend/lib/businessApplications.ts`, `frontend/app/(dashboard)/layout.tsx`, `frontend/app/(auth)/login/page.tsx`, `frontend/components/BusinessAccountForm.tsx`.
- Verification: `e2e/business-accounts-browser.cjs`, `e2e/laboratory-browser.cjs`, `e2e/reports-browser.cjs`, `.gitignore` (isolated cache only), this report and `docs/verification/2026-10-17/business-application-results.json`.
- Current documentation: `README.md`, `PROJECT_CONTEXT.md`.

Other uncommitted redesign/prerequisite files visible in git status predate this slice and were preserved.

## Remaining scope and limits

No unresolved business-rule decision blocks this requested slice. Later officer assignment, inspection evaluation, QR certificates, renewals, payments and notifications remain unimplemented. A submission is not an inspection result, certificate or laboratory approval. There is no draft, post-submission edit, deletion, duplicate-instrument business rule or application-report download in this selected intake contract.

Persistence and delivery replay assume one backend writer; there are no database transactions or cross-process uniqueness locks. Entered unsaved values survive request failures while the form stays open, but are not a reload-persistent draft. Application history uses existing JSON persistence and is not protected against filesystem edits. Production staff identity/session management, statutory test-plan completeness and official report acceptance remain the existing broader project limitations. Browser verification covers Chromium with emulated narrow layouts/themes/reduced motion; physical mobile devices, assistive technology, Firefox/WebKit and deployment were not tested.
