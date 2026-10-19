# W8LAB / SIH26035 — P0 stabilization and calculation integrity

Implementation and local verification: 18 October 2026. This is a P0 safety/stability result, **not full OIML compliance or completion of W8LAB**. No staff authentication replacement, Business expansion, migration, record deletion, commit, push or deployment was performed. Existing uncommitted work was preserved. No applicable AGENTS.md was found during prerequisite inspection.

## Scope and reference boundary

The confirmed SIH26035 priority is NAWI laboratory testing, calculation/evaluation and reporting, not the separately cached Business/inspection prototype. Official references consulted were the [SIH problem-statement listing](https://www.sih.gov.in/sih2026PS), [OIML R76-1:2006](https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf) and [R76-2:2007](https://www.oiml.org/en/files/pdf_r/r076-2-e07.pdf). P0 does not add new test formulas, claim that the five existing tabs exhaust R76-1, or claim that the current report matches all R76-2 forms.

The installed `.agents/skills/emil-design-eng/SKILL.md` was read and applied to the persistent completeness summary: plain labels, a visible reason for disabled approval, readable light/dark surfaces, narrow layouts, keyboard operation, and no new decorative measurement-entry motion. The explicitly invoked prototype workflow from the earlier design task was not rerun or integrated in this stabilization task.

## Reproduced causes and fixes

| Before | After | Why |
| --- | --- | --- |
| `next dev` on 3000 and `next start` on 3014 shared `.next`; production referenced hashed JS/CSS that dev had replaced. HTTP 500s and a missing `_error.js` were reproduced. | Default dev cache `.next-dev`; production build/start `.next-production`. Isolated runners retain an explicit independent override. Both live servers verified concurrently. | Prevents dev compilation from corrupting the production asset set; no cache deletion was necessary. |
| EvaluationService relabeled instrument `e=5` as kg when an observation selected kg, even though instrument parameters are stored implicitly in grams. Equivalent 5000/5005/2.5 g and 5/5.005/0.0025 kg produced Ec 5 g/PASS versus Ec 2.5025 kg/FAIL. | Instrument `e` stays `{value:'5',unit:'g'}`; raw observation quantities, including zero error, retain the selected unit and normalize with Decimal arithmetic. Both examples now produce Ec 5 g, MPE 5 g, PASS. | Observation display/input units must not change instrument characteristics. |
| One saved PASS observation could pass the submit/review gates, reach APPROVED and export FINAL/overall PASS with other tests NOT STARTED and required metadata absent. | Shared programme assessment supplies explicit per-test statuses, overall INCOMPLETE and issues. Final approval returns HTTP 409 until coverage, sampling, information and current resolved evaluations are complete. | Saved observations alone do not establish a complete applicable test programme. |
| Report aggregation reduced only the observed verdicts; stored tab flags could hide missing work. | Reports use the same assessment as final approval. Incomplete legacy APPROVED records remain untouched but newly generated reports are PROTOTYPE / INCOMPLETE. | Preserves history without repeating a false compliance claim. |
| PDF generator reset Y coordinates after 59 lines and drew over previous text on the same page. | Real multiple pages and wrapped long warning lines; pagination/xref regression tests. | Completeness warnings and measurement rows must remain readable. This is not a full R76-2 template implementation. |

## Calculation and completeness behavior

- Supported mass units are exactly mg, g, kg and t. Invalid units are rejected even when source and target strings are equal; inherited object keys are not valid units.
- Numeric observations and instrument `e` must be finite decimal strings. `e` must be positive; load/additional weights must be nonnegative. Calculations continue to use decimal.js with 100-digit precision, not binary floating-point arithmetic. No MPE tables were changed.
- Regressions cover equivalent mg/g/kg/t observations; g/kg calculations and MPE selection at the class II/III/IIII band boundaries; equality at MPE versus a decimal just above it; zero-error conversion; invalid intervals, values and units; rejected HTTP requests leaving data/audit unchanged.
- New evaluations carry a calculation version and an input fingerprint. Legacy/mismatched evaluations remain visible and stored but cannot be evidence of corrected programme completion. Reports do not silently recalculate them.
- Test statuses are PASS, FAIL, INCOMPLETE, NOT STARTED and justified NOT APPLICABLE. Tare N/A is justified only by the explicit existing `hasTare=false` profile with no contradictory tare observations. An absent flag or absent observations never establishes N/A.
- Overall INCOMPLETE takes precedence if any required information, applicability determination, sampling or resolved evaluation is missing. `observedOutcome` separately retains PASS/FAIL/UNDETERMINED so a recorded failure is not hidden by incompleteness.
- A determined, completely resolved programme with failed observations can be approved and reported as **FINAL / FAIL**, not forced to pass. Backend tests exercise both complete PASS and FAIL finalization/reporting contracts using clearly synthetic resolved programme fixtures.
- The synthetic contract fixtures **do not implement or verify native repeatability/zero-setting metrology**. Actual API/browser evaluation of those procedures remains BLOCKED and their programme status is INCOMPLETE.
- The optional programme determination is server-owned; no current public endpoint can install it, alter sampling, or accept client-supplied completion flags. A client cannot manufacture a finalizable plan by adding fields to test-case creation.
- **Native final approval currently remains blocked** until the future applicability/sampling module and missing evaluators are implemented and verified. This fail-closed state is deliberate. Review submission, reviewer claim, correction, resubmission, ownership, assignment, separation of duties, locks and report authorization remain functional.

## P0 files changed

Pre-existing branding, login, Business, navigation, theme and storage edits remain in the dirty worktree; they are not attributed to P0.

| Files | Major change |
| --- | --- |
| `frontend/next.config.js`, `frontend/tsconfig.browser.json`, `.gitignore` | Separate default dev/prod assets and isolated P0 verification cache/types. |
| `frontend/package.json`, `frontend/tests/runtime-config.test.cjs` | Node test-runner script and two cache/configuration regressions. |
| `backend/src/calculations/unitConversion.ts`, `engine.ts`, `backend/src/services/EvaluationService.ts` | Unit/finite-value validation, fixed gram instrument interval, evaluation version and input fingerprint. |
| `backend/src/services/ProgrammeAssessment.ts` | Shared fail-closed information/applicability/sampling/evaluation completeness assessment. |
| `backend/src/services/WorkflowService.ts` | Final-approval gate, preserving authorization and prior workflow checks. |
| `backend/src/services/ReportService.ts`, `backend/src/utils/HtmlGenerator.ts`, `SimplePdfGenerator.ts` | Honest report classification/outcome, visible incomplete reasons, actual PDF pagination. |
| `backend/src/types/domain.ts`, `report.ts` | Additive evaluation/plan/assessment types; no database migration. |
| `backend/src/routes/observationRoutes.ts`, `testCaseRoutes.ts`, `repositoryRoutes.ts` | Positive integer sequences, no invalid-null unit fallback, finite environment validation, assessment in protected record details. |
| `frontend/lib/laboratory.ts`, `frontend/app/(dashboard)/test-cases/[id]/workspace/page.tsx`, `frontend/app/(dashboard)/reports/page.tsx` | Assessment types, persistent responsive status/reasons and disabled final approval, legacy report warning. |
| `backend/tests/p0Integrity.test.ts` | 49 new regression cases, including pagination, unit conversion and complete PASS/FAIL contract fixtures. |
| `backend/tests/integration/{evaluationPipeline,laboratoryWorkflow,phase9,phase10}.test.ts`, `backend/tests/reportAuthorization.test.ts` | Replace seven unsafe single-row finalization/report expectations; retain correction, audit and authorization assertions. |
| `e2e/laboratory-browser.cjs` | Preserve the full runner, add three P0 scenarios, verify final rejection rather than unsafe approval; use a clearly synthetic legacy report fixture. |
| `e2e/p0-isolated-data.cjs` | Refuses existing nonempty directories; seeds only new ignored artifact storage, before backend start. Never changes project records or installs a programme determination. |
| `e2e/p0-runtime-browser.cjs`, `e2e/p0-integrity-browser.cjs` | Actual Chromium asset, native evaluator, failure, review and report verification. No mocked successes or forged browser sessions. |
| `README.md`, `PROJECT_CONTEXT.md`, this report | Current verified behavior, safe cache/run setup and mandatory next priorities. Historical reports are retained. |

## Exact verification results

All final runs below exited 0. Commands use Windows `npm.cmd`/`npx.cmd`; run the first two from `backend`, the next three from `frontend`, and browser commands from the project root.

| Command | Result |
| --- | --- |
| `npm.cmd test -- --runInBand --coverage=false --silent` | **272 PASS / 0 FAIL**, 17/17 suites; includes 49 P0 tests. |
| `npm.cmd test -- --runInBand tests/p0Integrity.test.ts --coverage=false --silent` | **49 PASS / 0 FAIL**, focused P0 rerun. |
| `npm.cmd run build` (backend) | PASS; TypeScript strict production build. |
| `npm.cmd test` (frontend) | **2 PASS / 0 FAIL**. |
| `npx.cmd tsc --noEmit -p tsconfig.browser.json` | PASS. |
| `npm.cmd run build` (frontend, default cache) | PASS; 15 pages generated, including dynamic laboratory/application routes. |
| `$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4005'; $env:W8LAB_BROWSER_BUILD_DIR='.next-p0-review'; npm.cmd run build` (frontend) | PASS; independent production build for real-backend browser checks. |
| `node e2e/laboratory-browser.cjs` | **40 PASS / 0 FAIL / 0 BLOCKED**. |
| `node e2e/p0-integrity-browser.cjs` | **6 PASS / 0 FAIL / 0 BLOCKED**. |
| `node e2e/instrument-submission.cjs` | **9 PASS / 0 FAIL / 0 BLOCKED**. |
| `node e2e/p0-runtime-browser.cjs` | **4 PASS / 0 FAIL / 0 BLOCKED**. |
| `git diff --check` | PASS; Git prints existing LF/CRLF normalization notices, not whitespace failures. |

Build warning: Next recommends adding its plugin to the extending browser tsconfig, although the base config already declares it. This did not fail type checking or either production build. No standalone ESLint configuration was introduced or lint coverage claimed.

The initial backend run exposed seven existing tests that asserted unsafe finalization; their assertions were changed to explicit completeness rejection (not skipped). Early browser harness attempts used incorrect Unit/tab accessible-name matches and a nonexistent repository detail URL. The harness was corrected to actual controls/endpoints, and all suites above were rerun successfully; failed-attempt artifacts were retained, not removed.

### Local service and browser setup

Main application verified at **http://127.0.0.1:3014**, backend **http://127.0.0.1:4000**, health `/api/v1/health`. Development frontend **http://127.0.0.1:3000** remained running while production routes/assets were checked. Actual production login used the documented, legitimately configured development staff account through the form; no browser token was forged. Main services retain their existing environment/configuration and original project data.

Final isolated run: frontend **http://127.0.0.1:3015**, backend **http://127.0.0.1:4005**, data `artifacts/browser-review/p0-20261018-verified/data`. Setup:

```powershell
# Root; the fixture script requires a fresh, empty browser-review run directory.
. .\e2e\local-staff-env.ps1
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/p0-20261018-verified'
node e2e/p0-isolated-data.cjs
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3015'
$env:W8LAB_BROWSER_BACKEND='http://127.0.0.1:4005'

# Separate backend terminal, before tests; no second writer to this DATA_DIR.
$env:DATA_DIR=Join-Path $env:W8LAB_BROWSER_RUN_DIR 'data'
$env:PORT='4005'
$env:CLIENT_URL='http://127.0.0.1:3015'
node backend/dist/index.js

# Separate frontend terminal, after the isolated frontend build above.
$env:W8LAB_BROWSER_BUILD_DIR='.next-p0-review'
npm.cmd start --workspace frontend -- --hostname 127.0.0.1 --port 3015

# Browser terminal with account/local-service variables above:
node e2e/laboratory-browser.cjs
node e2e/p0-integrity-browser.cjs
node e2e/instrument-submission.cjs
node e2e/p0-runtime-browser.cjs
```

Use a **different new directory** to rerun the full suite; do not overwrite this preserved evidence. The environment loader reads the existing supported local account setup without logging passwords. Isolated services are stopped after verification; main app/dev/backend remain available.

### Browser evidence

Chromium **156.0.8078.4**, Playwright **1.64.1**. Final artifacts (ignored, local):

- `artifacts/browser-review/p0-20261018-verified/attempt-2026-10-18T08-30-08-975Z/results.json`: full 40 scenarios, redacted network/console and saved state/history. Covers legitimate staff login, instrument creation, locks, gram/kg form equivalence, invalid input, review/correction/resubmission, stale revision, Administrator and Reviewer approval rejection, report download/Chromium PDF viewer, access isolation, offline retry, existing Business form regression, and original project JSON hashes unchanged.
- Same directory: `p0-equivalent-units.png`, `p0-mobile-light.png`, `p0-mobile-dark.png`, `administrator-final-approval-blocked.png`, `approved-report-open-in-browser.png` (legacy fixture is correctly PROTOTYPE, despite historical filename).
- `artifacts/browser-review/p0-20261018-verified/integrity-2026-10-18T08-31-32-117Z/results.json`: six native integrity scenarios. Screenshots `native-blocked-is-incomplete.png`, `failed-observations-incomplete-programme.png`, `legacy-incomplete-html-preview.png`; real downloaded `legacy-incomplete.pdf`.
- `artifacts/browser-review/p0-20261018-verified/submission-2026-10-18T08-31-36-690Z/results.json`: nine existing submission/lost-response scenarios; all PASS.
- `artifacts/browser-review/p0-20261018-runtime/results.json`: production/development concurrency, real login, all referenced production JS/CSS returning 200, no asset failures or uncaught exceptions; login/dashboard screenshots.

All checked browser suites had **zero uncaught application exceptions**. Expected HTTP 400/403/409 and offline errors from deliberate negative tests are retained separately and are not reported as unexpected runtime failures. Mobile checks used 390×844, light/dark, keyboard unit selection, reduced-motion preference and no document-wide horizontal overflow; screenshots were inspected. This is not a complete screen-reader or cross-browser audit.

## Remaining limitations and recommended next phase

1. **Secure staff authentication next**, as requested: replace development email-role/password behavior with legitimately provisioned staff identities, immutable authorization, safe bootstrap/administration and appropriate session handling. Preserve existing record ownership and Business isolation. No authentication bypass was added for P0.
2. Manufacturer selection still uses a placeholder in the current instrument form. The new gate exposes that gap and prevents finalization; completing manufacturer/instrument schema validation is mandatory follow-up, not Business application work.
3. Full server-owned R76-1 applicability, procedure-specific sampling and native repeatability/zero-setting evaluation remain missing. The additive plan contract has **no public setter** and must not be filled with arbitrary test counts to unblock approvals. Current five tabs, rule version text and unit tests are not proof of complete statutory coverage.
4. R76-2 report completeness, official template acceptance, full Unicode/fonts, immutable approval-time report registry, signatures and historical rule replay remain incomplete. PDF pagination is fixed, but the minimal PDF exporter uses printable ASCII and substitutes unsupported characters. Legacy evaluations are not silently recalculated or migrated.
5. Existing JSON persistence/audit atomicity and tamper resistance remain limited. No database migration or record reset was performed.
6. The older `e2e/reports-browser.cjs` setup expects a single weighing row to finalize. Its historical 13/13 count must not be reused as current evidence. Current report behavior is covered by P0/full browser and backend authorization tests; that old setup needs a future legitimate complete-programme fixture, not an approval bypass.
7. Business functionality was regression-checked by the full runner and backend suites, not expanded. The separate historical 24-scenario Business outage/restart runner was not rerun in P0; no fresh 24/24 claim is made.

P0 is complete for the requested reproduced defects and safety gates. Next implement secure staff authentication, then mandatory manufacturer/instrument and verified programme/procedure coverage, then standardized reporting. Do not start Business officer assignment, payments, notifications or certificates as a substitute for these SIH26035 requirements.
