# W8LAB — SIH26035 NAWI testing and reporting prototype

W8LAB digitizes laboratory testing of non-automatic weighing instruments (NAWIs): record measurements, calculate errors with decimal arithmetic, inspect saved compliance evaluations, request corrections, approve a test case and download an authorized report. It addresses error-prone spreadsheet calculations and disconnected review records.

This repository is a **local prototype**, not an accredited certification service or a production-hardened deployment. Staff authentication now uses persistent accounts and revocable sessions, not demo credentials. The user-facing application name is **W8LAB** and the repository/folder identifier remains **SIH26035**. Historical requirements use **Automated NAWI Compliance & Reporting System (ANCRS)**; that remains project context rather than the current product name. Priorities follow the confirmed SIH26035 NAWI testing/reporting brief, not the separate Business verification prototype. The original [blocker register](docs/phase-0/PHASE_0_BLOCKERS.md) is historical. See [P1 authentication](docs/P1_STAFF_AUTHENTICATION_2026-10-18.md) and [P0 integrity](docs/P0_STABILIZATION_2026-10-18.md); neither establishes full OIML compliance.

## Current scope and status

**P4A is partial and blocked (19 October 2026):** the fresh P3.1 automated gate passed before edits. Opt-in versioned performance plans/calculations/forms have been added locally, without migrating P3 history or removing final-approval blockers. Browser verification repeatedly encountered staff provisioning HTTP 503 (`rename EPERM` during strict JSON replacement); the one completed attempt passed all prior nested regressions but failed the new declaration scenario. The accessible-name repair is not browser-accepted yet. Work stopped under the prerequisite rule; **do not treat P4A as complete or proceed to P4B**. See [coverage, implementation, actual results and blockers](docs/P4A_METROLOGICAL_PERFORMANCE.md) and [native API contract](docs/NATIVE_PROGRAMME_API.md).

**Previous verified P3.1 baseline (18 October):** strict enum validation, explicit test-purpose dispatch and invalid-history blocking passed all four previously failing P4 prerequisite checks. That phase verified 523 backend tests, 39 frontend tests and 10 focused P3.1 browser scenarios. P4A had not started at that point; its current partial/blocked status is above. Final approval remains fail-closed for missing mandatory coverage. See [repair evidence](docs/P3_1_VALIDATION_AND_DISPATCH_REPAIR.md) and the [historical P4 audit](docs/P4_COMPLETE_OIML_TEST_COVERAGE.md).

| Area | Status in this branch |
| --- | --- |
| Laboratory instrument → test case → observations → saved evaluation → review/correction | Implemented and browser-verified; incomplete programmes cannot receive final approval |
| Programme completeness and final approval | Server-owned P3 applicability/sampling implemented for a limited profile; finalization remains blocked by unsupported mandatory procedures |
| Native repeatability and zero accuracy | P3 implemented: purpose-specific repeat series, four distinct zero mechanisms, decimal traces and fail-closed completeness; see [P3 coverage](docs/P3_OIML_APPLICABILITY_AND_NATIVE_TESTS.md) |
| Persistent staff authentication and Administrator provisioning | Implemented and browser/API verified; first Administrator needs private offline bootstrap |
| Manufacturer directory/create/edit/search and instrument registration/details/history | P2 implemented; real manufacturer selection, decimal validation, role/creator checks and frozen case metadata; see P2 verification report |
| Observation edit/delete with retained prior readings/evaluation in audit history | Implemented; owning technician in TESTING only |
| Report authorization and `/reports` list, HTML preview and PDF download | Implemented and browser-verified |
| Instrument rapid-submission guard, saved-instrument retry, readable themes and persistent labels | Implemented and browser-verified |
| Reviewer creation navigation and direct creation-route restriction | Implemented; instrument creation remains Technician-only |
| Business self-registration, persisted password hashes, login/session/logout and account page | Implemented account slice; browser-verified |
| Business application creation, submission, own list/details and history | Implemented and browser-verified; immutable SUBMITTED records |
| Business assignment, LMO/GATC inspection, prototype QR certificates and renewals | Absent; outside current SIH26035 priorities |
| Full statutory test-plan coverage, production security hardening, database transactions, official signatures, offline synchronization | Partial foundations or unimplemented requirements; see limits below |

The Business direction is an **additional verification prototype**, separate from both laboratory test-case states and the manufacturer/Director model-approval process described in older requirements. The selected cached prototype supplied the account and initial-application contracts. The implemented slice ends at submission and owner-visible tracking. Assignment, inspection, certificates and renewals remain future work. See [application contract and verification](docs/BUSINESS_APPLICATION_SLICE_2026-10-17.md), [discovery](docs/BUSINESS_APPLICATION_DISCOVERY_2026-10-16.md) and [account-slice evidence](docs/BUSINESS_ACCOUNTS_SLICE_2026-10-16.md).

## Users and permissions

| Role | Current behavior |
| --- | --- |
| Technician | Creates instruments/test cases, enters observations, corrects their own returned cases after resuming testing and submits for review. Cannot approve or read another technician's protected case/report. |
| Reviewer | Reads review-eligible laboratory records, claims review, returns with a reason or approves their assigned case. Cannot create instruments or edit raw readings. |
| Administrator | Staff provisioning/activation/password/session management at `/staff`, plus permitted laboratory oversight and review under the same assignment/separation-of-duties rules. Rule administration remains unimplemented. |
| Business | Registers and signs in to Applications, creates/submits initial verification applications and reads only their own list/details/history. Account details remain available. Has no laboratory API or staff-screen access. |

**Resolved policy:** Reviewer **and Administrator** may approve after claiming review; neither may review their own technician record or override another reviewer's claim. Some older SRS role tables exclude Administrator approval. The implemented policy follows the recorded clarification in [laboratory workflow documentation](docs/LABORATORY_REVIEW_WORKFLOW.md). LMO/GATC roles from the cached future prototype are not current laboratory roles.

## Laboratory workflow

1. A Technician selects/creates a real manufacturer at `/manufacturers`, then opens `/instruments/new` and supplies instrument identity, classification, declared units and measurement specifications. Supported registrations create an instrument and DRAFT case with a server-frozen metadata snapshot. Valid Class I/auxiliary/grading metadata opens details only, explicitly without evaluator support. `/instruments/[id]` and `/instruments/[id]/history` expose details and authorized case history. Linked specifications are protected from edits; legacy records are not migrated. See [master-data API](docs/MASTER_DATA_API.md).
2. DRAFT does not accept observations. **Start Testing** moves the case to TESTING. The technician saves conditions and observations; the backend computes and persists the calculation, rule and compliance outputs.
3. The current submission gate requires at least one observation and a saved evaluation for every recorded observation. **Submit for Review** moves the case to READY_FOR_REVIEW and locks technician edits. It does not establish a complete statutory test plan or require every verdict to be PASS.
4. A Reviewer or Administrator uses `/tests`, opens the workspace and **Start Review** to claim the case as UNDER_REVIEW.
5. **Return for Correction** requires a reason and moves it to RETURNED_FOR_CORRECTION. The owning technician sees that feedback, explicitly resumes TESTING, corrects readings and resubmits. Edit/delete audit entries retain prior observations and evaluations.
6. The assigned reviewer starts review again. Final approval now requires complete manufacturer/instrument/environment information, a determined server-owned applicability/sampling plan and resolved applicable tests. Failed but complete programmes are reportable as FAIL; missing, blocked, legacy or undetermined evidence cannot become PASS. P3 supplies limited native applicability/sampling; remaining unsupported mandatory procedures still prevent native finalization. APPROVED still locks raw mutations. `/reports` preserves access to legacy approved records, but newly generated incomplete outputs are explicitly PROTOTYPE / INCOMPLETE without rewriting the stored approval or observations.

Transitions require the record's `expectedRevision`; stale requests receive HTTP 409. Approval does not merge a laboratory record into a Business application or issue a public QR certificate. See [API/state contract](docs/LABORATORY_REVIEW_WORKFLOW.md), [report-access fix](docs/REPORT_ACCESS_FIX_2026-10-16.md) and [Reports navigation](docs/REPORTS_NAVIGATION_FIX_2026-10-16.md).

## Business application workflow

1. Register at `/register`, then sign in at `/business/login`. Business sign-in opens `/applications`.
2. Enter business name, installation address, instrument name/model/serial, accuracy class II/III/IIII, Max/Min/e/d in grams and tare-device status. Confirm the supported electronic, non-automatic, single-range weighing profile.
3. **Submit application** validates on the client and server, creates an `INITIAL` application in `SUBMITTED` state, and opens `/applications/[id]`. The selected prototype defines no draft or post-submission editing.
4. Reopen the Applications list, search, and view saved details/history. Backend ownership comes from the authenticated account; cross-Business detail reads return 404, staff application access returns 403, and attempts to edit or repeat the submit transition return 409.

Applications persist in their own `applications.json` using existing `DATA_DIR`/`JsonStore` conventions. An owner-scoped submission key makes retries of the same form delivery return the original application without creating another record/history entry. Retry does not edit the original record. New independent forms/tabs use new keys; this is not a business-level duplicate-instrument policy. See the [full contract](docs/BUSINESS_APPLICATION_SLICE_2026-10-17.md).

## Stack and architecture

- **Frontend:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS 3, Lucide icons; current light/dark utilities follow the browser's `prefers-color-scheme`.
- **Backend:** Node.js, Express 4, TypeScript, express-validator, JWT, Helmet, CORS and Winston. Business passwords use Node's salted scrypt and timing-safe comparison.
- **Evaluation:** decimal.js calculations → applicability/MPE rules → compliance verdict/trace, persisted with each observation.
- **Storage:** single-process JSON stores. Evidence metadata and optional base64 content are stored in JSON. Accounts, Business applications and P2 master records use opt-in atomic replacement/error rollback; ordinary laboratory case/observation stores retain their existing behavior. Use one writer per data directory.
- **Reports:** saved evaluation aggregation, SHA-256 dataset fingerprint, escaped HTML and the repository's PDF generator. No PDF browser service or official signing provider is configured.
- **Verification:** Jest/ts-jest/Supertest backend tests and Playwright Chromium browser runners using the real local backend. The npm lockfile pins the installed dependency graph.

```text
backend/src/
  app.ts, routes/          HTTP routes and shared laboratory access boundary
  middlewares/            token/role, record ownership, revision and validation checks
  calculations/           decimal calculations and unit conversion
  rules/, compliance/     applicability, MPE and verdict/explanation engines
  services/               laboratory workflow/evaluation, reports, accounts, Business applications
  repositories/           JSON stores and isolated DATA_DIR selection
  types/, utils/          domain contracts, HTML/PDF generation and logging
backend/tests/            backend regression suites; temporary isolated storage
frontend/app/             login/register, account, Business applications and laboratory pages
frontend/components/      shared Business registration/login form
frontend/lib/             session context, API helpers and laboratory contracts
e2e/                      real-browser runners and local fixture setup
docs/                     requirements, phase history, defect/fix reports
docs/verification/        selected redacted publication evidence
data/                     local persistence; contents excluded from Git
artifacts/browser-review/ local raw verification output; excluded from Git
```

The browser sends authenticated HTTP requests to Express; the backend enforces authorization before returning protected data. UI visibility is only a usability aid. Calculations and verdicts shown in the workspace come from saved backend evaluations, rather than a separate browser calculation. Reports consume those evaluations without silently recalculating them.

## Run locally

Use Node.js **20 or newer** and npm workspaces. The snapshot was checked with the versions recorded in the [verification report](docs/verification/2026-10-16/SNAPSHOT_VERIFICATION.md). From the repository root:

```sh
npm ci
```

Copy [backend/.env.example](backend/.env.example) to `backend/.env`, and [frontend/.env.example](frontend/.env.example) to `frontend/.env.local`. Keep the local backend URL and supply your own local JWT secret; never commit these populated files. The example contains placeholders, not usable credentials.

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port; defaults to 4000 |
| `NODE_ENV` | Local development mode; do not treat setting production as production hardening |
| `JWT_SECRET` | Private random signing secret, at least 32 characters; required in production. If omitted locally, a private durable random key is generated in DATA_DIR/authSecrets.json. No shared fallback. |
| `CLIENT_URL` | Comma-separated exact permitted frontend origins, e.g. `http://localhost:3000,http://127.0.0.1:3014` |
| `DATA_DIR` | Optional absolute path to local persistence; use a separate directory for synthetic testing |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend backend origin, e.g. `http://localhost:4000`; public configuration, never a secret |
| `W8LAB_BROWSER_BUILD_DIR` | Optional separate Next cache for verification; selects `tsconfig.browser.json` |

Development and production use **different default caches**: `.next-dev` and `.next-production`. This prevents the reproduced missing-JS/CSS HTTP 500 failure when `next dev` and `next start` run concurrently. Do not give concurrent servers the same explicit cache override, or rebuild a production cache while it is being served. Old `.next` files need not be deleted. Production API configuration is fixed at build time.

Start **two terminals** from the root:

```sh
# Terminal 1
npm run dev --workspace backend
```

```sh
# Terminal 2
npm run dev --workspace frontend
```

Open **http://localhost:3000**; health is **http://localhost:4000/api/v1/health**. Set both frontend API origin and backend CORS origin when changing ports. Environment changes to the frontend require a restart/rebuild. The root `dev` workspace command is not a concurrent process supervisor; use the two commands above.

Build/start without development watchers:

```sh
npm run build --workspace backend
npm run build --workspace frontend
# In separate terminals, with the same environment used for building:
npm run start --workspace backend
npm run start --workspace frontend
```

## Accounts and authentication limits

Business users visit `/register`, enter name/email/password, then sign in at `/business/login` and land at `/applications`. `/account` remains available from Business navigation. Registration only creates Business accounts, rejects role escalation and normalized duplicate emails, and reserves documented/referenced staff identities. Passwords are hashed; hashes never appear in account responses. See [account policy and verification](docs/BUSINESS_ACCOUNTS_SLICE_2026-10-16.md) and the [application slice](docs/BUSINESS_APPLICATION_SLICE_2026-10-17.md).

Laboratory `/login` starts with blank credentials and verifies a persisted, active Technician, Reviewer or Administrator account. There is **no shared demo password, automatic account creation or email-text role mapping**. Roles/IDs are immutable after provisioning; authorized Administrators use `/staff` to provision staff, deactivate/reactivate, reset passwords and revoke sessions. Backend checks are authoritative. Staff passwords use salted scrypt (N=131072, r=8, p=1); no password/hash is returned by staff APIs.

**First Administrator setup is required on the main dataset.** Stop the backend, build it, provide your own `W8LAB_BOOTSTRAP_NAME`, `W8LAB_BOOTSTRAP_EMAIL` and `W8LAB_BOOTSTRAP_PASSWORD` privately in its process environment, then run `npm run staff:bootstrap --workspace backend`. Start the backend again and sign in. The CLI refuses any existing staff store; there is no public bootstrap endpoint or default account. See [secure PowerShell setup and legacy adoption](docs/P1_STAFF_AUTHENTICATION_2026-10-18.md#manual-setup). No main-dataset account or password was invented during verification.

An Administrator may explicitly adopt a verified person's recognized legacy identity during provisioning to preserve record ownership. Default new staff get UUIDs; login never infers roles from emails. No test case, audit actor, report or Business account is reassigned. Old pre-P1 tokens must sign in again.

Both account types use eight-hour signed Bearer tokens plus a persistent, hashed session identifier. Logout revokes that session server-side; staff deactivation/password reset/revoke-all invalidate previous sessions. Every protected request resolves the active persisted account and server session. The frontend revalidates on navigation/focus and every 60 seconds. Offline logout reports failure and stays retryable. LocalStorage Bearer storage remains XSS-sensitive; HTTPS, managed production secrets/ACLs, stronger deployment controls, MFA/recovery and distributed rate limits are not provided by passing P1. Do not expose this local instance as a production service.

## Checks and real-browser setup

```sh
npm run test --workspace backend -- --runInBand --coverageReporters=text-summary --coverageReporters=json
npm run test --workspace frontend
npm run build --workspace backend
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
npm run build --workspace frontend
git diff --check
```

The frontend has 39 Node test-runner registration/cache/session/native-input regressions, not a Jest suite. Its production build performs the existing type/build checks. Use text/JSON coverage reporters because the HTML reporter previously encountered a Windows source-map export issue. Browser builds/API tests alone are not browser verification.

Install the local Playwright Chromium binary if needed:

```sh
npx playwright install chromium
```

The following PowerShell setup keeps test requests and records local. Choose a **new** run directory for every full laboratory run; do not delete or reuse existing laboratory fixtures for its initial empty-state check.

For the current complete managed P1 verification, first build the backend and an isolated frontend with `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4006` and `W8LAB_BROWSER_BUILD_DIR=.next-p1-review`, then run `node e2e/p1-browser.cjs`. It privately bootstraps isolated staff, exercises real provisioning and starts/stops only its own 3016/4006 services. Detailed commands are in the [P1 report](docs/P1_STAFF_AUTHENTICATION_2026-10-18.md). The older manual setup below additionally requires legitimately provisioned accounts and explicit `W8LAB_BROWSER_*` credentials; its helper no longer extracts passwords from source.

```powershell
# Backend terminal. Create this fresh directory; preserve previous run directories.
$browserRun=Join-Path (Get-Location) 'artifacts/browser-review/my-new-run'
New-Item -ItemType Directory -Path (Join-Path $browserRun 'data') | Out-Null
$env:W8LAB_BROWSER_RUN_DIR=$browserRun
# Before starting the backend: synthetic legacy report fixture for the full runner.
node e2e/p0-isolated-data.cjs
$env:DATA_DIR=Join-Path $browserRun 'data'
$env:PORT='4003'
$env:CLIENT_URL='http://127.0.0.1:3012'
npm.cmd run dev --workspace backend
```

```powershell
# Frontend terminal. Ensure these ports are free or choose another local pair.
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4003'
$env:W8LAB_BROWSER_BUILD_DIR='.next-business-accounts'
npm.cmd run dev --workspace frontend -- --hostname 127.0.0.1 --port 3012
```

```powershell
# Browser terminal, using the same directory served by the backend.
. .\e2e\local-staff-env.ps1
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/my-new-run'
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3012'
$env:W8LAB_BROWSER_BACKEND='http://127.0.0.1:4003'
node e2e/business-accounts-browser.cjs
node e2e/laboratory-browser.cjs
# Optional focused runners; keep their output/dataset requirements in mind:
node e2e/instrument-submission.cjs
node e2e/p0-integrity-browser.cjs
```

The local environment helper validates explicitly supplied provisioned test-account variables without printing credentials; it no longer extracts a password from source. The managed P1 runner provides isolated setup. Browser runners reject nonlocal origins, mask credentials in screenshots and retain ignored evidence. Successful flows use real backend responses; deliberate failures are documented per runner. Jest always uses disposable temporary storage, even if inherited DATA_DIR names existing records. Never run two backend writers against one JSON directory. Historical Business runner commands require their own separate dataset; their old staff demo setup is not current authentication guidance.

## Verified results

Latest **P3.1** checks on 18 October 2026: **523 backend tests / 22 suites**, including **87 expanded validation tests**, the original **5 prerequisite tests** and **37 native tests**; **39 frontend tests**. All passed, as did TypeScript, backend/frontend production builds and `git diff --check`. Actual Chromium: P3.1 **10/0/0**, P3 **17/0/0**, P2 **16/0/0**, laboratory **40/0/0**, P0 **6/0/0**, retry **9/0/0**, managed wrapper **25/0/0** and main smoke **6/0/0**. Wrapper/nested counts are not additive. [P3.1 report](docs/P3_1_VALIDATION_AND_DISPATCH_REPAIR.md) includes exact commands, changed files, red/green evidence and screenshots. For the managed run, also set `W8LAB_BROWSER_P3_1=1`.

Previous **P3** checks on 18 October 2026: **431 backend tests / 20 suites**, including **37 native procedure tests**; **39 frontend tests**. Backend build, frontend production build and standalone TypeScript checks passed. Actual Chromium: P3 **17/0/0**, laboratory **40/0/0**, P0 integrity **6/0/0**, instrument retry **9/0/0**, P2 **16/0/0** and managed staff/P2/P3 wrapper **24/0/0** (nested counts are not additive). Original project JSON hashes remain unchanged. [P3 implementation report](docs/P3_OIML_APPLICABILITY_AND_NATIVE_TESTS.md) contains the coverage matrix, independent examples, exact commands, screenshots and remaining gaps. For the managed run, build with API `http://127.0.0.1:4006` and cache `.next-p3-review`; enable `W8LAB_BROWSER_P2=1` and `W8LAB_BROWSER_P3=1`, then run `node e2e/p1-browser.cjs` with a new artifact directory.

Previous **P2** checks on 18 October 2026: **394 backend tests / 19 suites**, **28 frontend tests**, both standalone TypeScript checks and production builds passed. Actual Chromium P2 **16/0/0**, laboratory **40/0/0**, P0 integrity **6/0/0**, instrument retry **9/0/0**, managed security/P2 wrapper **23/0/0**, main-app non-mutating smoke **5/0/0**. Wrapper counts include nested runner success checks, not additive scenarios. Original project JSON hashes remain unchanged. See [P2 implementation, files, exact commands, screenshots and limits](docs/P2_MANUFACTURER_INSTRUMENT_MANAGEMENT.md) and [master-data API](docs/MASTER_DATA_API.md).

Previous **P1** checks on 18 October 2026: **325 backend tests / 18 suites**, **10 frontend tests**, TypeScript and both production builds passed. Managed P1 browser **22/0/0**, nested laboratory **40/0/0**, P0 integrity **6/0/0**, instrument retry **9/0/0**. These are separate suites (the P1 wrapper includes three nested-runner result checks), not additive counts. See [P1 evidence and remaining limits](docs/P1_STAFF_AUTHENTICATION_2026-10-18.md).

Latest P0 checks on **18 October 2026**: **272 backend tests across 17 suites**, **2 frontend runtime tests**, frontend/backend builds and frontend TypeScript checks passed. Full laboratory browser **40 PASS / 0 FAIL / 0 BLOCKED**; focused native integrity browser **6/6**; dev/production asset browser **4/4**; instrument submission/retry **9/9**. See [commands, files, fixtures, screenshots and limitations](docs/P0_STABILIZATION_2026-10-18.md). Single-observation final-approval expectations were replaced with explicit rejection assertions, not bypassed. Synthetic resolved PASS/FAIL programmes test the finalization contract in backend tests only; native repeatability/zero procedures remain BLOCKED.

Historical checks on **17 October 2026**: 223 backend tests across 16 suites; Business browser 24/0/0; laboratory browser 37/0/0. The former blocked Business application scenario exercises registration/login and the actual submission/detail form against the real backend. See [application verification](docs/BUSINESS_APPLICATION_SLICE_2026-10-17.md). Business functionality was preserved, not expanded in P0.

The older focused Reports runner's 13/13 result is historical: its setup assumes single-row final approval and is not a valid P0 compliance test. Current report access, PDF viewing and incomplete HTML/PDF warnings are covered by the updated full runner, focused P0 runner and backend authorization tests. The historical Business runner includes a real backend outage/restart and retry after a committed response is lost. All workflow tests used isolated local records.

The [16 October snapshot report](docs/verification/2026-10-16/SNAPSHOT_VERIFICATION.md) retains its historical 201 backend tests, 36/0/1 laboratory and 15/0/1 Business counts. Its blocked entry describes the then-absent application workflow. Historical reports and finalized reports are preserved; current results are recorded separately. Bulk artifacts, downloads and saved record snapshots remain excluded from Git. Passing this slice does not establish completion of later Business phases or the entire project.

## Important limits and next priorities

- Native P3 execution supports digital electronic, graduated, single-range NAWIs, classes II/III/IIII with d=e: repeatability and non/semi/automatic/tracking zero accuracy. Generic weighing/eccentricity/tare rows remain available but do not establish full procedure coverage. Class I, auxiliary/grading, multi-range/interval, analog/mechanical and unimplemented procedures cannot silently pass. Instrument values remain grams; observation units normalize independently with decimal arithmetic. P3 currently accepts exact nominal repeat loads as a narrower application profile; no approximate-load tolerance is invented.
- Native recorded series must be complete before review submission; completed failures can enter review. The full programme remains INCOMPLETE while mandatory technical examinations, weighing/eccentricity/tare series, zero controls and influence/electronic procedures are unsupported or undetermined. Neither missing nor unsupported evidence becomes N/A. P2 validates registration metadata, not full instrument conformity. Linked legacy records without snapshots remain read-only; remediation needs an approved policy.
- Instrument submission uses a synchronous UI guard and reuses a confirmed saved instrument if later test-case creation fails. Ambiguous delivery stops automatic retries. This is **not backend idempotency** and does not prevent independent clients/tabs from creating distinct records. Business duplicate-email checks also assume one backend writer.
- JSON storage is not a transactional database. Ordinary laboratory writes still have legacy error-handling limits; audit history is not tamper-proof against filesystem edits. Strict account/application writes and application retry keys assume a single backend writer and do not make all laboratory operations atomic.
- Reports use saved evaluations and a generated SHA-256 fingerprint, carry a prototype/template disclaimer, and get generation IDs/timestamps. There is no immutable approval-time report registry, official template acceptance, statutory signature or public certificate lookup. Report access remains protected across data/HTML/PDF; listing approved records does not generate them.
- Dynamic rule-version administration, full historical replay guarantees, offline synchronization, external government integrations, direct instrument connectivity and production account/security hardening are not completed features. Older phase PASS/completion reports are historical design/gate documents, not evidence that all current requirements are implemented.
- Browser evidence covers Chromium desktop and a narrow viewport; Firefox/WebKit, real autofill, assistive-technology and deployed-environment verification remain untested.

Next mandatory phase: native ascending/descending weighing series (A.4.4.1), initial zero-error capture and prescribed load transitions, followed by receptor-specific eccentricity/tare and remaining mandatory procedures. Complete the technical/zero-control/influence/electronic evidence paths before expanding native final-approval eligibility; then complete R76-2 report-format coverage. P2/P3 are limited profiles, not all possible configurations or full OIML conformity. Staff authentication is implemented; production security hardening remains a deployment prerequisite. Do not prioritize Business expansion, certificates, payments or notifications outside the mandatory SIH26035 brief. Read historical proposals alongside current evidence.
