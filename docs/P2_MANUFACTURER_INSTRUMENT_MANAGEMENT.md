# W8LAB — P2 Manufacturer & Instrument Management

18 October 2026. SIH26035, local implementation only. No Business feature expansion, data migration/reset, branch changes, commits, pushes or deployment. This is registration and traceability support for the documented profile, **not full OIML conformity or certification**.

## Prerequisite verification

Before P2 implementation, inspected the dirty worktree, README, PROJECT_CONTEXT, P0/P1 reports, authentication/session/role middleware and the current laboratory policy. No applicable AGENTS.md was found in the project or direct ancestors. Preserved unrelated and previous uncommitted work.

The focused prerequisite command passed **179 tests / 5 suites**:

```powershell
npm.cmd test --workspace backend -- --runInBand tests/staffAuthentication.test.ts tests/p0Integrity.test.ts tests/security.test.ts tests/reportAuthorization.test.ts tests/integration/laboratoryWorkflow.test.ts --coverage=false --silent
```

P1 uses persisted salted scrypt staff identities, active controls and revocable sessions. Roles are not inferred from email and there is no normal shared password. No prerequisite security blocker was reproduced. Deployment limitations of localStorage bearer storage, single-writer JSON and operator-managed TLS/ACLs remain documented; this phase does not claim production security hardening. Browser verification subsequently reprovisioned isolated staff through the supported offline bootstrap and actual Administrator form, not forged successful tokens.

## Findings and implementation

The old instrument form sent `mfr_placeholder`, the manufacturer API lacked a complete editing/validation path, registration accepted incomplete/unchecked specifications, instrument details/history links were not functional, and evaluation/report metadata resolved live master records. A mutable shared record could therefore change the metadata associated with a historical case.

Implemented:

- Manufacturer directory/search/details/create/edit and selection in instrument registration. Required name, address and identifier; normalized duplicate detection; creator/Administrator permissions and stale-revision rejection. An unused manufacturer can be soft-archived; linked identities are retained and cannot be removed.
- Instrument registration with real active manufacturer, identity/model/serial, class, Max/Min/e/d, derived n, explicit mass unit and device/configuration declarations. Software identification is required when declared software-controlled; approval mark is explicitly unverified; optional technical notes are not invented.
- Independent frontend and backend decimal validation. Original decimal strings/units are retained; canonical values remain grams to preserve P0/evaluator conventions. Manufacturer+serial is the application uniqueness namespace. Forged/privileged master-data properties are rejected.
- Instrument details and owner/review-authorized testing history. Unlinked registration edits require creating Technician or Administrator. ANY linked case locks instrument edits, independent of case state. Shared staff catalog visibility does not expose unauthorized case IDs/readings/reports.
- New cases deep-copy validated master metadata into versioned server-owned snapshots. Observation creation/edit, programme assessment, repository detail/list and reports resolve that snapshot. Client-supplied snapshots cannot override it.
- Manufacturer edits affect current directory data but not frozen case/report metadata. Legacy linked cases without snapshots block manufacturer edits rather than being migrated. Existing evaluations/references/approvals are retained. HTML/PDF and structured report data include manufacturer, technical specifications and provenance without recalculating saved observations. Regenerated reports still obey P0 INCOMPLETE/PROTOTYPE rules; no issued file is rewritten.
- Synchronous submission guards, preserved inputs, confirmed-rejection retry, saved-instrument reuse and ambiguous-delivery stop behavior. Manufacturer save response loss was exercised after a real backend commit. No automatic resend or fake success response was introduced.

### UI review — emil-design-eng guidance applied

Used installed `.agents/skills/emil-design-eng/SKILL.md` for persistent labels, measured/readable surfaces, keyboard focus, restrained interactions and supported themes. Did not run prototype: this task integrates a mandatory management slice, not a new variant exploration. No global theme redesign or decorative measurement-entry animation was added.

| Before | After | Why |
| --- | --- | --- |
| Hardcoded invisible manufacturer reference | Searchable labeled selection with create/refresh path | Real traceable identity, no invented manufacturer |
| Unqualified numeric strings | Explicit unit selector, derived n and relationship errors | Clarify physical quantities before testing |
| Broken directory action targets | Instrument details and authorized history routes | Make saved instruments discoverable without leaking restricted cases |
| Live metadata only | Frozen workspace metadata and explicit legacy provenance | Avoid silent historical specification drift |
| Optional new fields without explicit label IDs in first P2 build | Persistent `htmlFor`/ID bindings, including populated textarea | Existing browser label regression caught and verified the fix |
| Unsupported profiles could look test-ready | Registration-only warning and no case for unsupported evaluators | Separate stored metadata from calculation capability |

## Validation scope and standards

Primary references inspected: [OIML R76-1:2006](https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf), particularly §§3.2/3.4, Tables 2/3 and markings §7.1; [OIML R76-2:2007](https://www.oiml.org/en/files/pdf_r/r076-2-e07.pdf) for reporting context. Registration checks apply positive quantities, interval-step conventions, n/class/Min boundaries and e/d relationships for declared graduated single-range profiles. They do not establish environmental, software-security, construction, marking or test-programme conformity. Tariff/toll grading and auxiliary-device declarations have explicit limited metadata rules; specialist sub-milligram exceptions are deferred.

Metadata-valid Class I, auxiliary and grading registrations are stored with **unsupported evaluation** explanations; no new case is allowed for them. Automatic/mechanical/non-weighing/multi-range profiles are rejected without saving. Native supported classes remain II/III/IIII within the existing evaluator scope; registration does not make missing repeatability/zero-setting procedures available. No P0 calculation/MPE formula or final-approval guard was changed.

Full request fields, validation errors and RBAC are documented in [MASTER_DATA_API.md](MASTER_DATA_API.md). [ARCHITECTURE.md](../ARCHITECTURE.md) now separates current implementation from historical proposals. README and PROJECT_CONTEXT describe actual current status rather than retaining the manufacturer-placeholder claim.

## Routes and local setup

UI routes: `/manufacturers`, `/manufacturers/new`, `/manufacturers/[id]`, `/manufacturers/[id]/edit`, `/instruments`, `/instruments/new`, `/instruments/[id]`, `/instruments/[id]/edit`, `/instruments/[id]/history`, existing `/test-cases/[id]/workspace`.

Main local app: `http://127.0.0.1:3014` (production) / `http://127.0.0.1:3000` (development), API `http://localhost:4000/api/v1`. Browser verification uses isolated production frontend `http://127.0.0.1:3016`, backend `http://127.0.0.1:4006`, fresh ignored data and private generated credentials. Managed verification services stop at completion.

No staff accounts or manufacturer/instrument values are auto-created in the main project data. An operator must bootstrap the first Administrator privately and provision legitimate staff using the [P1 setup](P1_STAFF_AUTHENTICATION_2026-10-18.md). Then a Technician/Administrator creates a real manufacturer; a Technician registers an actual supported instrument. Do not use synthetic screenshot values as real specifications.

## Verification

Final verification results and evidence paths follow. Browser assertions exercise actual UI and real backend responses; negative tests modify requests or drop a real response, never synthesize a successful API response. All original project JSON file hashes were unchanged before/after managed runs and main-service restarts. Temporary fixtures never point at the main data directory.

| Check | Result |
| --- | --- |
| Backend complete suite | 394 PASS / 0 FAIL, 19 suites |
| Frontend Node test runner | 28 PASS / 0 FAIL (18 registration + 10 prior cache/session tests) |
| Backend/frontend standalone TypeScript | PASS |
| Backend production build | PASS |
| Frontend production build | PASS |
| P2 actual browser/API scenarios | 16 PASS / 0 FAIL / 0 BLOCKED |
| Existing full laboratory browser runner | 40 PASS / 0 FAIL / 0 BLOCKED |
| Existing P0 integrity browser runner | 6 PASS / 0 FAIL / 0 BLOCKED |
| Existing instrument submission/retry browser runner | 9 PASS / 0 FAIL / 0 BLOCKED |
| Managed P1 security/P2 wrapper | 23 PASS / 0 FAIL / 0 BLOCKED |
| Restarted main-app non-mutating browser smoke | 5 PASS / 0 FAIL / 0 BLOCKED |
| `git diff --check` | PASS (existing Windows LF/CRLF warnings are not whitespace errors) |

Wrapper counts include nested runner success checks and **must not be added** to the nested counts. No measured coverage percentage is claimed. Existing P0 tests retain incomplete-finalization rejection and completed FAIL reportability. The explicit snapshot/report test uses an isolated legacy APPROVED fixture to inspect PROTOTYPE output, not a native approval bypass.

Commands executed from project root (PowerShell):

```powershell
npm.cmd test --workspace backend -- --runInBand tests/masterData.test.ts tests/integration/evaluationPipeline.test.ts tests/p0Integrity.test.ts --coverage=false --silent
# Focused 125 PASS / 0 FAIL
npm.cmd test --workspace backend -- --runInBand --coverage=false --silent
npm.cmd test --workspace frontend
npm.cmd run build --workspace backend
npx.cmd tsc --project backend/tsconfig.json --noEmit --incremental false
npx.cmd tsc --project frontend/tsconfig.browser.json --noEmit --incremental false
$env:W8LAB_BROWSER_BUILD_DIR='.next-p2-review'
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4006'
npm.cmd run build --workspace frontend
$env:W8LAB_BROWSER_P2='1'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/p2-2026-10-18-final'
node e2e/p1-browser.cjs
$env:W8LAB_MAIN_SMOKE_DIR='artifacts/browser-review/p2-2026-10-18-main'
$env:W8LAB_MAIN_SMOKE_P2='1'
node e2e/p1-main-smoke.cjs
git diff --check
```

Choose a new run directory on reruns; the runner deliberately refuses to overwrite existing data or take over occupied ports. Sandbox process creation initially returned EPERM for the frontend Node runner; the authorized subprocess-enabled run passed. Initial browser run1 caught the explicit-label defect and a new runner's ambiguous alert selector/populated textarea label. The old retry assertion also required the new service's actual validation message. These were corrected, without dropping scenarios or changing the backend rejection/retry expectations. Run2 passed all suites; the final rerun also passed with the completed software-control edit and report metadata additions. Earlier failed evidence is retained, not overwritten.

### Browser coverage and screenshots

P2 checks manufacturer rapid create/search/invalid/duplicate/retry/archive, actual malformed/valid kg registration, exact persisted grams/n, forged/invalid payloads, real case snapshot/workspace, detail/history reload, cross-Technician and Reviewer isolation, creator/Admin/linked edit guards, manufacturer edit preserving historical metadata, Class I register-only and unlinked editing, unsupported configuration rejection, committed-response loss, keyboard focus, 390px light/dark reduced-motion layouts and production asset/runtime health. Parent restart verifies catalog persistence alongside session validity/revocation. Backend snapshot tests verify HTML/PDF metadata and unchanged saved calculations. Full runner retains Business regression coverage without implementing Business functionality.

Local ignored evidence root: `artifacts/browser-review/p2-2026-10-18-final/`. P2 `results.json` and screenshots are under `p2/`; nested runners retain their timestamped subdirectories. Credentials are masked/redacted. Chromium only; no Firefox/WebKit/assistive-technology claim.

Final browser version: Chromium 156.0.8078.4. P2 and parent suites recorded zero uncaught page exceptions and zero failed Next asset responses. Expected invalid-input/forbidden/network-loss probes generate deliberate failed API requests, not successful-response mocks. Main smoke at `artifacts/browser-review/p2-2026-10-18-main/` confirms the actual 3014/4000 runtime, blank staff login, protected routes and concurrent dev/production asset health without provisioning main accounts. Main frontend build also passed against the configured `http://localhost:4000` API. Managed 3016/4006 verification services were stopped; main 3014/4000 and existing dev 3000 remain available.

- [Manufacturer directory](../artifacts/browser-review/p2-2026-10-18-final/p2/manufacturer-directory-desktop.png)
- [Manufacturer details](../artifacts/browser-review/p2-2026-10-18-final/p2/manufacturer-details-desktop.png)
- [Instrument registration](../artifacts/browser-review/p2-2026-10-18-final/p2/instrument-registration-desktop.png)
- [Instrument details](../artifacts/browser-review/p2-2026-10-18-final/p2/instrument-details-desktop.png)
- [Testing history](../artifacts/browser-review/p2-2026-10-18-final/p2/instrument-history-desktop.png)
- [Snapshot-backed workspace](../artifacts/browser-review/p2-2026-10-18-final/p2/workspace-frozen-metadata.png)
- [Unsupported evaluator explanation](../artifacts/browser-review/p2-2026-10-18-final/p2/unsupported-profile-details.png)
- [Dark mobile registration](../artifacts/browser-review/p2-2026-10-18-final/p2/instrument-registration-mobile-dark.png)
- [Light mobile manufacturer form](../artifacts/browser-review/p2-2026-10-18-final/p2/manufacturer-form-mobile-light.png)

## P2 file manifest (previous uncommitted P0/P1 changes are not attributed to P2)

Backend:

- `backend/src/services/MasterDataService.ts` — validation, normalization, protection and snapshot resolver.
- `backend/src/routes/manufacturerRoutes.ts`, `instrumentRoutes.ts` — CRUD/catalog/history API and RBAC.
- `backend/src/routes/testCaseRoutes.ts` — validated saved registration and server-created snapshot.
- `backend/src/routes/observationRoutes.ts`, `repositoryRoutes.ts` — resolve snapshot at evaluation/detail reads.
- `backend/src/services/ProgrammeAssessment.ts`, `RepositoryService.ts`, `ReportService.ts` — consistent snapshot metadata/completeness/report integration.
- `backend/src/repositories/index.ts` — strict atomic master persistence.
- `backend/src/types/domain.ts`, `types/report.ts`, `utils/HtmlGenerator.ts` — additive metadata contracts and report presentation.
- `backend/tests/masterData.test.ts` — 69 additional cases: validation/boundaries/relationships/roles/archives/duplicates/snapshots/legacy/protection/reports/storage failure.
- `backend/tests/integration/evaluationPipeline.test.ts`, `backend/tests/p0Integrity.test.ts` — legitimate fixture fields under the stricter registration contract; invalid legacy evaluation and P0 guard assertions retained.

Frontend:

- `frontend/components/ManufacturerViews.tsx`, `InstrumentRecord.tsx`, `InstrumentRegistration.tsx` — management UI and reusable guarded registration, extracted without losing prior safe-retry behavior.
- `frontend/lib/masterData.ts`, `frontend/tests/masterData.test.cjs` — shared contracts, exact-decimal form feedback and regression tests.
- `frontend/app/(dashboard)/manufacturers/page.tsx`, `manufacturers/new/page.tsx`, `manufacturers/[id]/page.tsx`, `manufacturers/[id]/edit/page.tsx` — manufacturer routes.
- `frontend/app/(dashboard)/instruments/[id]/page.tsx`, `instruments/[id]/edit/page.tsx`, `instruments/[id]/history/page.tsx`, `instruments/new/page.tsx` — details/history/edit and thin registration entry route.
- `frontend/app/(dashboard)/instruments/page.tsx`, `layout.tsx` — corrected route links, directory failures, staff-only Manufacturers navigation.
- `frontend/app/(dashboard)/test-cases/[id]/workspace/page.tsx`, `frontend/lib/laboratory.ts` — frozen manufacturer/specification/provenance display.
- `frontend/package.json`, `package-lock.json` — explicitly declare already-installed decimal.js for client validation; no unrelated upgrades.
- `frontend/tsconfig.browser.json`, `.gitignore` — isolated P2 Next build types/cache.

Verification/documentation:

- `e2e/p2-browser.cjs` — new real UI/API runner.
- `e2e/p1-browser.cjs` — optional P2 runner hook and catalog restart assertion; P1 checks retained.
- `e2e/p1-main-smoke.cjs` — optional distinct evidence path/P2 anonymous-route smoke; prior P1 evidence retained.
- `e2e/laboratory-browser.cjs`, `e2e/instrument-submission.cjs`, `e2e/p0-integrity-browser.cjs` — real manufacturer/explicit valid registration fixtures and new validation-message expectation; no scenario removed.
- `README.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `docs/INDEX.md`, `docs/LABORATORY_REVIEW_WORKFLOW.md`, `docs/MASTER_DATA_API.md`, this report — current status/contracts/evidence.

## Remaining limits and next mandatory phase

- This slice supports the documented electronic, non-automatic, graduated, single-range metadata profile, not all R76 configurations or every specialized technical field. Class I/auxiliary/grading testing and automatic/multi-range/mechanical profiles remain unsupported as stated above. Declared approval marks/software IDs are not independently verified.
- Legacy linked registrations with incomplete data stay read-only. No specification/identity is inferred, and no approval/evaluation is recalculated or record migrated. A controlled remediation/revision policy is separate work.
- P0 native final approval remains **blocked** until a verified server-owned applicability/sampling plan and missing native procedures exist. A valid registration is not a complete test programme. Official R76-2 standardized report-format/signature coverage remains unfinished.
- JSON atomic master writes are not multi-record/database transactions or distributed duplicate protection. One backend writer only. No general POST idempotency, offline synchronization, import/export feature or master archive-restoration UI was added. Existing unrelated catalog import/delete placeholders were not expanded.
- Main project setup still requires an operator-provisioned Administrator/staff account. No production/test credentials were hardcoded or disclosed. Production security hardening and non-Chromium/accessibility audits remain separate limitations.

Recommended P3: implement and verify server-owned applicable-test selection/sampling using saved instrument metadata, then missing repeatability/zero-setting evaluations with independently checked R76 fixtures and traceability. Keep finalization fail-closed until coverage is proven; follow with R76-2 reporting coverage. Do not expand Business applications/payments/renewals.
