# W8Lab / ANCRS — NAWI laboratory and Business account prototype

W8Lab digitizes laboratory testing of non-automatic weighing instruments (NAWIs): record measurements, calculate errors with decimal arithmetic, inspect saved compliance evaluations, request corrections, approve a test case and download an authorized report. It addresses error-prone spreadsheet calculations and disconnected review records.

This repository is a **local prototype**, not an accredited certification service or a production authentication system. The repository/folder identifier is **SIH26035**; source and requirements also use **Automated NAWI Compliance & Reporting System (ANCRS)** and **W8Lab**. These are project labels, not confirmation of an official SIH problem-statement number. The original [blocker register](docs/phase-0/PHASE_0_BLOCKERS.md) records the missing official problem statement/domain report.

## Current scope and status

| Area | Status in this branch |
| --- | --- |
| Laboratory instrument → test case → observations → saved evaluation → review/correction → approval | Implemented and browser-verified |
| Observation edit/delete with retained prior readings/evaluation in audit history | Implemented; owning technician in TESTING only |
| Report authorization and `/reports` list, HTML preview and PDF download | Implemented and browser-verified |
| Instrument rapid-submission guard, saved-instrument retry, readable themes and persistent labels | Implemented and browser-verified |
| Reviewer creation navigation and direct creation-route restriction | Implemented; instrument creation remains Technician-only |
| Business self-registration, persisted password hashes, login/session/logout and account page | Implemented account slice; browser-verified |
| Business application form/list/submission | **Absent; browser workflow remains BLOCKED** |
| Business assignment, LMO/GATC inspection, prototype QR certificates and renewals | Future prototype direction; absent from this branch |
| Full statutory test-plan coverage, production identity/admin management, database transactions, official signatures, offline synchronization | Partial foundations or unimplemented requirements; see limits below |

The Business direction is an **additional verification prototype**, separate from both laboratory test-case states and the manufacturer/Director model-approval process described in older requirements. Cached Git history contains a broader prototype, but only its Business account foundation was extracted here. Do not infer that applications, officers or QR verification work because accounts exist. See [discovery](docs/BUSINESS_APPLICATION_DISCOVERY_2026-10-16.md) and [account-slice evidence](docs/BUSINESS_ACCOUNTS_SLICE_2026-10-16.md).

## Users and permissions

| Role | Current behavior |
| --- | --- |
| Technician | Creates instruments/test cases, enters observations, corrects their own returned cases after resuming testing and submits for review. Cannot approve or read another technician's protected case/report. |
| Reviewer | Reads review-eligible laboratory records, claims review, returns with a reason or approves their assigned case. Cannot create instruments or edit raw readings. |
| Administrator | Permitted laboratory access, claim/review/approval under the same assignment and separation-of-duties rules. Full staff/rule administration UI is not implemented. |
| Business | Registers and signs in to their account page. Has no laboratory API or staff-screen access. No application submission is available yet. |

**Resolved policy:** Reviewer **and Administrator** may approve after claiming review; neither may review their own technician record or override another reviewer's claim. Some older SRS role tables exclude Administrator approval. The implemented policy follows the recorded clarification in [laboratory workflow documentation](docs/LABORATORY_REVIEW_WORKFLOW.md). LMO/GATC roles from the cached future prototype are not current laboratory roles.

## Laboratory workflow

1. A Technician opens `/instruments/new`, supplies instrument information and classification/measurement parameters, then creates an instrument and its DRAFT test case.
2. DRAFT does not accept observations. **Start Testing** moves the case to TESTING. The technician saves conditions and observations; the backend computes and persists the calculation, rule and compliance outputs.
3. The current submission gate requires at least one observation and a saved evaluation for every recorded observation. **Submit for Review** moves the case to READY_FOR_REVIEW and locks technician edits. It does not establish a complete statutory test plan or require every verdict to be PASS.
4. A Reviewer or Administrator uses `/tests`, opens the workspace and **Start Review** to claim the case as UNDER_REVIEW.
5. **Return for Correction** requires a reason and moves it to RETURNED_FOR_CORRECTION. The owning technician sees that feedback, explicitly resumes TESTING, corrects readings and resubmits. Edit/delete audit entries retain prior observations and evaluations.
6. The assigned reviewer starts review again and approves. APPROVED locks raw mutations. `/reports` lists eligible authorized approved records and explicitly opens/downloads their HTML/PDF output.

Transitions require the record's `expectedRevision`; stale requests receive HTTP 409. Approval does not merge a laboratory record into a Business application or issue a public QR certificate. See [API/state contract](docs/LABORATORY_REVIEW_WORKFLOW.md), [report-access fix](docs/REPORT_ACCESS_FIX_2026-10-16.md) and [Reports navigation](docs/REPORTS_NAVIGATION_FIX_2026-10-16.md).

## Stack and architecture

- **Frontend:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS 3, Lucide icons; current light/dark utilities follow the browser's `prefers-color-scheme`.
- **Backend:** Node.js, Express 4, TypeScript, express-validator, JWT, Helmet, CORS and Winston. Business passwords use Node's salted scrypt and timing-safe comparison.
- **Evaluation:** decimal.js calculations → applicability/MPE rules → compliance verdict/trace, persisted with each observation.
- **Storage:** single-process JSON stores. Evidence metadata and optional base64 content are stored in JSON. Account persistence uses opt-in atomic replacement/error rollback; ordinary laboratory stores retain their existing behavior.
- **Reports:** saved evaluation aggregation, SHA-256 dataset fingerprint, escaped HTML and the repository's PDF generator. No PDF browser service or official signing provider is configured.
- **Verification:** Jest/ts-jest/Supertest backend tests and Playwright Chromium browser runners using the real local backend. The npm lockfile pins the installed dependency graph.

```text
backend/src/
  app.ts, routes/          HTTP routes and shared laboratory access boundary
  middlewares/            token/role, record ownership, revision and validation checks
  calculations/           decimal calculations and unit conversion
  rules/, compliance/     applicability, MPE and verdict/explanation engines
  services/               workflow, evaluations, audit, evidence, reports, accounts
  repositories/           JSON stores and isolated DATA_DIR selection
  types/, utils/          domain contracts, HTML/PDF generation and logging
backend/tests/            backend regression suites; temporary isolated storage
frontend/app/             login/register, account and laboratory App Router pages
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
| `JWT_SECRET` | Signing secret; supply a private value instead of the existing development fallback |
| `CLIENT_URL` | Comma-separated permitted frontend origins, e.g. `http://localhost:3000` |
| `DATA_DIR` | Optional absolute path to local persistence; use a separate directory for synthetic testing |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend backend origin, e.g. `http://localhost:4000`; public configuration, never a secret |
| `W8LAB_BROWSER_BUILD_DIR` | Optional separate Next cache for verification; selects `tsconfig.browser.json` |

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

Business users visit `/register`, enter name/email/password, then sign in at `/business/login` and land at `/account`. Registration only creates Business accounts, rejects role escalation and normalized duplicate emails, and reserves documented/referenced staff identities. Passwords are hashed; hashes never appear in account responses. See [account policy and verification](docs/BUSINESS_ACCOUNTS_SLICE_2026-10-16.md).

Laboratory `/login` retains **development/demo authentication**, including its existing pre-filled local default, email-based role mapping and stable synthetic IDs. The role preview is not a server-side role selector. This is not a production staff-account registry; no staff bootstrap/creation CLI was extracted. The [local laboratory guide](docs/LABORATORY_REVIEW_WORKFLOW.md) identifies synthetic roles without publishing password values. Existing staff behavior was deliberately preserved rather than silently migrating record owners.

Both workflows use the current eight-hour Bearer JWT in browser localStorage. Logout removes the current browser token; it does not revoke previously issued tokens server-side. Business sessions resolve an active persisted account. Production session management, staff authentication, password recovery/email verification and distributed rate limiting remain future work. Do not expose this demo directly as a production service.

## Checks and real-browser setup

```sh
npm run test --workspace backend -- --runInBand --coverageReporters=text-summary --coverageReporters=json
npm run build --workspace backend
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
npm run build --workspace frontend
git diff --check
```

The frontend production build performs its existing lint/type checks; there is no frontend Jest suite. Use text/JSON coverage reporters because the HTML reporter previously encountered a Windows source-map export issue. Browser builds/API tests alone are not browser verification.

Install the local Playwright Chromium binary if needed:

```sh
npx playwright install chromium
```

The following PowerShell setup keeps test requests and records local. Choose a **new** run directory for every full laboratory run; do not delete or reuse existing laboratory fixtures for its initial empty-state check.

```powershell
# Backend terminal. Create this fresh directory; preserve previous run directories.
$browserRun=Join-Path (Get-Location) 'artifacts/browser-review/my-new-run'
New-Item -ItemType Directory -Path (Join-Path $browserRun 'data') | Out-Null
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
node e2e/reports-browser.cjs
```

The local environment loader reads only the existing demo setup without printing credentials. It is not a production account-setup tool. Browser runners reject nonlocal origins, mask credentials in screenshots and write raw evidence under the ignored run directory. Successful flows use real backend responses; deliberate failure injections are documented per runner. Jest always uses disposable temporary storage, even if an inherited `DATA_DIR` names existing records. Do not run two backend writers against one JSON directory.

## Verified results

Latest completed implementation checks on **16 October 2026**: **201 backend tests across 14 suites**, frontend/backend builds and frontend TypeScript check passed; Business browser **15 PASS / 0 FAIL / 1 BLOCKED**; full laboratory browser **36 PASS / 0 FAIL / 1 BLOCKED**. See [Business account report](docs/BUSINESS_ACCOUNTS_SLICE_2026-10-16.md).

Fresh pre-publication rerun results, tooling versions and selected redacted evidence are recorded separately in the [snapshot verification report](docs/verification/2026-10-16/SNAPSHOT_VERIFICATION.md). Historical reports retain the original failures and local artifact paths; bulk artifacts, downloads and saved record snapshots are intentionally excluded from Git. Passing the laboratory suite does not establish completion of the entire project. **The Business application workflow remains BLOCKED.**

The fresh snapshot run also passed **201 backend tests**, both builds/frontend checks, **36 / 0 / 1** full laboratory browser scenarios, **15 / 0 / 1** Business browser scenarios and **9 / 0** focused submission/retry scenarios. These are separate suites; their BLOCKED entries refer to the same absent Business application workflow.

## Important limits and next priorities

- Current rule execution supports a limited electronic, manual, single-range NAWI profile: classes II/III/IIII and weighing/eccentricity/tare paths. Class I, repeatability/zero-setting execution and other configurations can be deferred/BLOCKED despite broader schema/UI/SRS coverage. No new metrology thresholds or completeness criteria were introduced to make browser tests pass.
- Submission checks saved evaluation presence, not a complete statutory sampling/test matrix or a passing overall result. Manufacturer selection in instrument creation still uses a placeholder identifier. Production validation and a confirmed test-plan contract need separate work.
- Instrument submission uses a synchronous UI guard and reuses a confirmed saved instrument if later test-case creation fails. Ambiguous delivery stops automatic retries. This is **not backend idempotency** and does not prevent independent clients/tabs from creating distinct records. Business duplicate-email checks also assume one backend writer.
- JSON storage is not a transactional database. Ordinary laboratory writes still have legacy error-handling limits; audit history is not tamper-proof against filesystem edits. The account store's stricter writes do not make all laboratory operations atomic.
- Reports use saved evaluations and a generated SHA-256 fingerprint, carry a prototype/template disclaimer, and get generation IDs/timestamps. There is no immutable approval-time report registry, official template acceptance, statutory signature or public certificate lookup. Report access remains protected across data/HTML/PDF; listing approved records does not generate them.
- Dynamic rule-version administration, full historical replay guarantees, offline synchronization, external government integrations, direct instrument connectivity and production account/security hardening are not completed features. Older phase PASS/completion reports are historical design/gate documents, not evidence that all current requirements are implemented.
- Browser evidence covers Chromium desktop and a narrow viewport; Firefox/WebKit, real autofill, assistive-technology and deployed-environment verification remain untested.

Next priorities: define and implement the smallest Business application intake slice with confirmed fields/ownership rules; retain its separate lifecycle; then specify assignment/inspection and prototype-only QR/validity/renewal contracts. Independently address production identity/storage/reliability and resolve the official problem statement, approved test coverage and report format before broader claims. Start with [project context](PROJECT_CONTEXT.md), [SRS baseline](docs/SRS/SRS_v0.2.md) and [phase plan](SIH_NAWI_SRS_and_PhasePlan.md), reading their proposals alongside the implementation/status notes above.
