# W8LAB P3: Applicability, sampling and native tests

**19 October follow-up:** [P4A partial implementation and blocked verification](P4A_METROLOGICAL_PERFORMANCE.md) adds an opt-in version without rewriting this phase's saved programmes/results. The P3/P3.1 browser regressions still passed in the completed attempt. P4A itself is not browser-accepted; recurring staff-persistence failures require resolution first. [Native API versions](NATIVE_PROGRAMME_API.md) documents the additive contract.

**P3.1 follow-up (18 October 2026):** the P4 audit found enum-coercion defects missed by this report's original normal-path tests. Those defects are now repaired: all four rejection regressions pass, alongside 523 backend tests, 39 frontend tests and 10 focused P3.1 browser scenarios. Persisted malformed programmes are blocked without rewriting history. See [repair and verified prerequisite readiness](P3_1_VALIDATION_AND_DISPATCH_REPAIR.md) and [original reproduction](P4_COMPLETE_OIML_TEST_COVERAGE.md). Historical P3 evidence below retains its original scope/counts; P4A remains unimplemented.

18 October 2026. SIH26035. Local implementation and verification of a limited instrument profile. This document supersedes older statements that generic observation tabs establish repeatability, zero-setting or complete statutory coverage.

## Basis and prerequisite checks

Primary sources: [OIML R76-1:2006](https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf) and [OIML R76-2:2007](https://www.oiml.org/en/files/pdf_r/r076-2-e07.pdf). Consult the complete recommendations for the normative requirements. The implementation is a subset, not a declaration of complete OIML conformity or an accredited certificate.

Read the attached P3 request, README, project context, P0/P1/P2 evidence, existing calculations, JSON persistence, role/case middleware, review gates and reports. No applicable AGENTS.md was found in the repository or direct ancestors. Existing uncommitted changes and original JSON records were preserved. No Business workflow was expanded.

Before P3, the focused P0/P1/P2/auth/report/workflow regression command passed **241 tests in 5 suites**. Persistent staff authentication and frozen P2 master metadata were already implemented; they were reused. Generic observation evaluation remains available for its earlier scope and is not substituted for native series coverage.

## Implementation and routes

UI: `/test-cases/[id]/programme`, linked from the existing workspace's programme status section. The owning Technician declares purpose and additional characteristics, sees the applicability matrix and sampling, enters actual observations and inspects persisted calculations and missing requirements. Eligible/assigned reviewers have read-only access under the existing case policy.

Authenticated API:

| Method and route | Contract |
| --- | --- |
| GET `/api/v1/native/:id` | Authorized case, frozen programme, native evidence and shared completeness assessment |
| PUT `/api/v1/native/:id/programme` | Owning Technician, DRAFT/TESTING, current `expectedRevision`, strict `profile`; requires P2 snapshot |
| PUT `/api/v1/native/:id/tests/:procedure/:series` | Owning Technician, TESTING, current revision, strict `submission`; server evaluates |

P3.1 validation contract: purpose, indication and receptor must be supported primitive strings; zero-device inventory members are also strict primitive enums. Invalid new inputs return 400 without mutation. Invalid persisted programmes return a safe GET view with `programme:null` and `programmeError`; calculation/mutation attempts return 409, and assessment remains INCOMPLETE/UNDETERMINED. Original case metadata and saved traces are retained. See the P3.1 report for exhaustive dispatch, history and generic laboratory-enum protections.

Programme input includes purpose, indication type, explicit zero-device inventory, initial-zero device, eccentric-use characteristics, receptor/supports and documentation reference. Unknown attributes are explicit, not guessed. A no-eccentricity declaration additionally needs a justification. No client verdict, assigned reviewer, owner, lifecycle status, ruleset or instrument snapshot is accepted through these endpoints.

Each programme freezes the instrument, profile, clause decisions, actor/time, edition, SHA-256 instrument fingerprint and ruleset `W8LAB-R76-2006-P3-1`. It may be corrected before native observations. Afterwards it is immutable, so existing results cannot be reinterpreted under another purpose or device inventory. Switching the existing generic MPE context is also prohibited once generic observations exist.

Native evidence uses the existing JSON architecture in `nativeTests.json`, with one stable case/procedure/series ID. It records raw quantity strings and units, conditions, evidence reference, normalized gram values, P/E/limits, spread and verdict, version and input fingerprint. Corrections retain the previous record in audit metadata. Durable atomic file writes are used for native evidence and native case revisions. No database migration or historical record rewrite occurs.

## Supported profile and coverage register

Native calculation support is limited to electronic, graduated, digital, single-range NAWIs, classes II/III/IIII with d=e, within the existing P2-valid registration profile. Class I, auxiliary/grading, mechanical/analog, multi-range and multi-interval calculation procedures remain unsupported. P2 can store some registration-only profiles; that does not make them evaluable. The purpose is explicitly TYPE_EVALUATION, INITIAL_VERIFICATION or IN_SERVICE_INSPECTION. Subsequent verification is not silently classified as service inspection.

The UI matrix groups requirements to expose gaps. It is not an exhaustive clause-by-clause certification checklist. This extended register identifies the additional missing coverage:

| Requirement / clauses | Implemented scope | Remaining limitation / applicability |
| --- | --- | --- |
| Classification and scale intervals, 3.1-3.4 | P2 declared quantities/class validation and frozen metadata | Specialist classes/devices/ranges are unsupported; registration is not physical conformity |
| MPE, 3.5.1 Table 6; 3.5.2; 8.4 | Existing verified decimal MPE selection reused for native repeats | Service inspection has twice initial MPE; subsequent verification has initial limits |
| Repeatability, 3.6/3.6.1; A.4.10; A.4.4.3 | REQUIRED native series for known supported profile | Unknown indication/zero inventory is UNDETERMINED; unsupported configurations cannot save an evaluation |
| Eccentricity, 3.6.2; A.4.7 | Receptor/support/usage declarations and explicit decisions | Position-specific protocol/sketch/load validation is UNSUPPORTED; N/A only with explicit no-eccentricity justification and evidence |
| Other permissible differences, 3.6.3-3.6.4; partial ranges, A.4.5 | Gap register only | Extension/receptor/range-specific programme is unsupported, never inferred from generic rows |
| Test standards and general conditions, 3.7; 3.10; A.4.1 | Laboratory conditions plus equipment/accuracy/stability evidence attestations | No automated uncertainty-budget, calibration validity, warm-up, preloading or environmental conformity determination |
| Setting zero before loading, A.4.3 | Unloaded readings, rest and reset declarations for repeatability | No general weighing-series E0 protocol yet |
| Weighing, 3.5; A.4.4.1/A.4.4.3 | Existing generic row calculations preserved | Full ascending/descending load selection, Min/Max/MPE transitions and series validation UNSUPPORTED |
| Zero accuracy, 4.5.2; A.4.2.3.1/.2 | Separate native NON_AUTOMATIC, SEMI_AUTOMATIC, AUTOMATIC, ZERO_TRACKING determinations | Absent declared devices N/A with inventory reference; unknown inventory UNDETERMINED; service-inspection limit treatment UNSUPPORTED pending verified policy |
| Zero ranges, controls, indicating and tracking, 4.5.1/4.5.4-4.5.7; A.4.2.1/.2; A.4.12 | Explicit separate blocking matrix group | Range, timing, stability controls, indicator and tracking-rate procedures UNSUPPORTED; accuracy alone does not complete 4.5 |
| Supplementary weighing, 4.5.1; A.4.4.2 | No initial device: documented N/A | Initial device unknown: UNDETERMINED; present without verified range/procedure: UNSUPPORTED; no assumed <=20% range |
| Tare/preset tare, 4.6-4.7; A.4.6 | Explicit P2 tare-device declaration | N/A for declared no tare; otherwise mechanism/capacity/series procedures UNSUPPORTED or UNDETERMINED |
| Discrimination, 3.8; A.4.8; 8.3.3 | Digital verification exclusion and d<5 mg type exclusion recorded | Other digital type tests and analog protocol UNSUPPORTED; unknown indication UNDETERMINED |
| Sensitivity, 6.1; A.4.9 | Unsupported configuration register | Non-self-indicating instruments are outside native profile; no automatic N/A based on missing data |
| Time/influence, 3.9; A.4.11-.12; A.5-A.6 | Blocking grouped decisions | Creep/zero-return/equilibrium/tilt/temperature/humidity/power/endurance protocols missing; verification needs approved type/location/use evidence |
| Technical/visual/markings, 4-7; A.1-A.3; 8.2/8.3 | Identity, software/marking declarations and evidence references | Required examination and special-use requirements UNSUPPORTED; declarations are unverified |
| Electronics/software, 5; Annex B | Blocking grouped decisions | Disturbance, span stability, power/interface/software tests unsupported; verification exemptions not guessed |
| Modules, Annex C-G | Blocking grouped decision | Configuration, compatibility and module certification path unimplemented |
| Metrological controls, 8 | Test purpose and existing authorized review/correction | Full legal control/type certificate/location-specific determination unavailable |
| R76-2:2007 standardized reporting | Native data, trace fields and coverage added to existing prototype HTML/PDF | Full official layout and mandatory sections remain a later phase |

Every NOT APPLICABLE decision has an explicit frozen device/profile fact or clause exclusion and explanation. Missing tests are NOT STARTED, unknown attributes UNDETERMINED and unimplemented procedures UNSUPPORTED. These states cannot satisfy the final gate.

## Sampling and actual observation capture

| Purpose / profile | Repeat series | Required observations per series |
| --- | --- | --- |
| Type evaluation, Max <1000 kg | About half Max and near Max | 10 each |
| Type evaluation, Max >=1000 kg | About half Max and near Max | At least 3 each |
| Verification, class II | About 0.8 Max | 6 |
| Verification, class III/IIII | About 0.8 Max | 3 |

W8LAB currently accepts **exact nominal 50%/100%/80% targets** as a deliberately narrower supported selection. These are not claimed as mandatory exact loads in the standard: the recommendation permits approximate targets without providing a numeric tolerance there. Other approximate loads are explicitly rejected pending a verified selection policy. Each series must retain the same target load, be ordered from sequence 1, and stay between Min and Max. At least-count series may contain more readings. The 100-row request cap is an application resource limit, not an OIML sampling rule.

For each repetition, capture L, I, additional changeover weights, unloaded indication, unloaded rest and whether a deviation was reset. Fitted automatic zero/tracking devices must be confirmed in operation. The displayed readings must be multiples of the frozen d=e. No readings, rest confirmations or calibration evidence are prefilled.

Zero accuracy captures one recorded determination for the selected mechanism. Direct non/semi-automatic determinations use post-setting L=I=0 and confirmation that zero was initiated near changeover. Automatic/tracking determinations use a known positive load outside the automatic range, confirmed by the operator. **10e is an example**, not a hard minimum or universally required load. Other automatic devices must not interfere with a direct measurement. This single accuracy determination does not cover zero range, signalling, controls or rate tests.

Partial valid samples persist as INCOMPLETE. Malformed strings, exponent notation, unsupported units, missing equipment reference, wrong targets, unordered sequences and privileged fields are rejected. Inputs remain visible after rejection. Stable loaded indications and sufficient changeover determination accuracy must be confirmed, with supporting equipment evidence.

## Calculation methodology and independent examples

All quantities normalize to grams using decimal.js with the existing 100-digit precision. No binary floating-point arithmetic, displayed rounding or universal 0.1e changeover quantum determines the result. Accepted units: mg, g, kg, t. P2 e and d are already grams and are never relabeled with the observation unit.

`P = I + e/2 - deltaL`; `E = P - L` (A.4.4.3). Repeatability compares `max(E)-min(E)` to the absolute MPE at the constant load and also checks every `abs(E)` against that MPE (3.6/3.6.1). No E0 is subtracted between repetitions: the R76-2 section 5 fields and A.4.10 support the recorded individual errors/spread. Zero accuracy uses `E0 = P - L` and `abs(E0) <= 0.25e` (4.5.2/A.4.2.3). These paths are separate from generic corrected-error calculations.

Independent literals in `backend/tests/nativeProcedures.test.ts` verify, for class III Max=15000 g, Min=100 g, e=d=5 g:

| Observations / change | Independent expected result |
| --- | --- |
| Repeat L=12000, I=12000, delta=2.5 g | P=12000, E=0, spread=0, MPE=7.5 g: PASS |
| Repeat errors -2.5, 0, +5 g | Spread=7.5 g, inclusive boundary PASS |
| Last delta changes 2.5 to 2.4999 g with I=12005 g | E=5.0001, spread=7.5001 g: FAIL despite each error being within MPE |
| All I=12010, delta=2.5 g | Every E=10, spread=0: FAIL on individual errors |
| Direct zero L=I=0, delta=1.25 g | E0=+1.25 g = +0.25e: PASS |
| Direct zero delta=3.75 g | E0=-1.25 g = -0.25e: PASS |
| Zero delta=1.2499 / 3.7501 g | E0=+1.2501 / -1.2501 g: FAIL |
| Zero delta=1.2499999999999999999999999 g | Exact positive exceedance retained: FAIL |
| L=12 kg, I=12.005 kg, delta=0.0025 kg | Same P=12005 g, E=5 g, MPE=7.5 g as equivalent grams |
| Initial/service repeat limits at 12000 g | 7.5 / 15 g; service zero remains explicitly unsupported |

Tests use literal expected answers, not production functions to generate expected values. Large-capacity/type and class-II verification sample counts, malformed units, incomplete conditions and storage failures have separate tests.

## Workflow and reporting integrity

Native records use existing Technician ownership and Reviewer/Administrator case authorization. Backend revision checks reject overlapping/stale actions. Submit-for-review accepts completed failed native series for examination, but rejects any recorded incomplete native series. Submission is not technical completion. Review/correction/resume remains the existing lifecycle. Assigned reviewers still cannot approve their own cases or override the shared completeness gate.

An individual native PASS is not overall PASS. Unsupported mandatory groups keep the whole programme INCOMPLETE and final approval blocked. A completed failed type series remains an observed FAIL even if its companion series is missing. A genuinely complete supported programme could report FAIL; legacy P0 contract tests verify that outcome without pretending the currently unsupported native groups are complete.

Reports collect frozen applicability and native evidence, reference versions and calculated traces; seals include native records only for native cases, preserving legacy seal inputs. Report generation still requires existing authorized APPROVED access. P3 does not add a bypass or a draft download endpoint. Because native final approval is blocked, native HTML/PDF assembly is tested with an explicitly isolated legacy-approved fixture; it produces PROTOTYPE / INCOMPLETE. This fixture is not a successfully approved native workflow. Existing real-browser legacy report access/download tests remain separate. No finalized report or stored legacy approval is rewritten.

The existing 59-line PDF pagination and wrapping remain in use. Full R76-2 formatting, attachments/calibration evidence interpretation, official signatures, long Unicode text and structured technical examinations remain gaps.

## UI review

Applied installed `.agents/skills/emil-design-eng/SKILL.md`: persistent labels/units, readable grouped forms/tables, keyboard focus, inherited themes and no decorative measurement-entry motion.

| Before | After | Why |
| --- | --- | --- |
| Generic observation rows could imply a full procedure | Dedicated series and mechanism forms, explicit required sample counts | Make actual procedure coverage visible |
| Missing applicability only appeared at final approval | Traceable matrix, unknown attributes and blocking reasons | Resolve missing information before measurement |
| Unit context was implicit | Unit choice before entry, locked after values, gram traces | Prevent accidental relabeling of existing quantities |
| Single pass/fail label concealed missing programme coverage | Individual outcome and overall completeness shown separately | Retain failures without false completion |
| A missing companion series could hide an observed failure | Completed series retain observed FAIL while procedure remains incomplete | Preserve technical evidence independently of completeness |

## Verification and evidence

Browser runs use temporary isolated DATA_DIR, private random credentials, supported Administrator bootstrap/provisioning and actual backend responses. No successful authentication or native calculation response is fabricated. Lost-response tests deliberately drop an actual committed response. Artifacts are ignored locally and contain redacted logs/screenshots rather than credentials.

Final automated commands (run from repository root):

```powershell
npm.cmd test --workspace backend -- --runInBand --coverage=false --silent --json --outputFile=../artifacts/browser-review/p3-backend-final-results.json
npm.cmd test --workspace frontend
npm.cmd run build --workspace backend
node node_modules/typescript/bin/tsc --noEmit --incremental false -p backend/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json

$env:W8LAB_BROWSER_BUILD_DIR='.next-p3-review'
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4006'
npm.cmd run build --workspace frontend
$env:W8LAB_BROWSER_P2='1'
$env:W8LAB_BROWSER_P3='1'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/p3-2026-10-18-final'
node e2e/p1-browser.cjs
# Choose another NEW run directory to repeat; the runner refuses reuse.

# In a fresh terminal with the normal main frontend configuration:
npm.cmd run build --workspace frontend
$env:W8LAB_MAIN_SMOKE_DIR='artifacts/browser-review/p3-2026-10-18-main'
$env:W8LAB_MAIN_SMOKE_P2='1'
$env:W8LAB_MAIN_SMOKE_P3='1'
node e2e/p1-main-smoke.cjs
git diff --check
```

The isolated build uses `.next-p3-review`, while the main production build uses `.next-production` and development uses `.next-dev`. Do not rebuild a cache while its production server is serving it. Node test workers, Chromium and Next build workers required subprocess permission outside the restricted shell; initial EPERM attempts were rerun with that permission, without changing assertions.

| Final check | Actual result |
| --- | --- |
| Full backend suite | **431 PASS / 0 FAIL**, 20 suites, 33.303 s |
| Native regression subset | **37 PASS / 0 FAIL**, included in full backend count |
| Frontend Node tests | **39 PASS / 0 FAIL** |
| Backend / frontend standalone TypeScript | Both PASS |
| Backend build; isolated and main frontend production builds | All PASS |
| P3 actual Chromium scenarios | **17 PASS / 0 FAIL / 0 BLOCKED** |
| Existing full laboratory browser runner | **40 / 0 / 0** |
| Existing P0 integrity browser runner | **6 / 0 / 0** |
| Existing instrument overlap/lost-response runner | **9 / 0 / 0** |
| Existing P2 browser runner | **16 / 0 / 0** |
| Managed staff/P2/P3 wrapper | **24 / 0 / 0**, includes nested-runner checks; do not add counts |
| Main localhost non-mutating browser smoke | **6 / 0 / 0** |
| Additional isolated atomic-storage diagnostic | 500 saves, 0 failures |
| `git diff --check` | PASS; existing Windows LF/CRLF advisories only |

Chromium **156.0.8078.4** exercised actual declarations, blank required fields, incomplete sampling, kg normalization, rapid saves, frozen declarations, stale revisions, forged verdicts, invalid units, all four zero mechanisms, positive/negative outcomes, reload, audit corrections, cross-user access, Reviewer read-only views, blocked final approval, type-evaluation 10+10 series, real validation rejection/retry, committed-response loss and mobile light/dark keyboard/reduced-motion behavior. Mobile matrix scrolling works by keyboard inside a labeled focusable region. No uncaught application exceptions, missing JS/CSS assets or unexpected console errors occurred. The 14 console resource errors from deliberate rejection/lost-delivery probes are retained in evidence and explicitly checked; they are not reported as zero console messages.

The managed runner also restarts its backend and checks native records through the authenticated API, as well as persisted accounts/session revocation and instrument history. Original main project JSON hashes remained unchanged. Main staff accounts were not auto-created. First-Administrator setup still follows the [P1 private bootstrap instructions](P1_STAFF_AUTHENTICATION_2026-10-18.md#manual-setup).

Earlier evidence is retained honestly: the pre-resumption backend run reported 426/2; the first full rerun passed 428/0 before three additional regressions brought the final count to 431/0. No old assertion was removed or weakened. The previous two failures did not reproduce, so their cause is unconfirmed. An initial browser run had transient strict-storage 503s during existing instrument writes, cascading old-runner failures, plus a P3 test that accidentally used a non-quantized indication while expecting the nominal-load error. The test now holds the indication valid to exercise the intended invalid load. Storage error-code diagnostics were added without exposing data. Two subsequent full managed browser runs passed all runners; the 500-save diagnostic also passed. The earlier intermittent storage failure's underlying OS cause remains unconfirmed, not claimed fixed by logging.

Evidence:

- [Final backend results](../artifacts/browser-review/p3-backend-final-results.json)
- [Managed browser results](../artifacts/browser-review/p3-2026-10-18-final/results.json)
- [P3 browser scenarios and console record](../artifacts/browser-review/p3-2026-10-18-final/p3/results.json)
- [Redacted services/scenario log](../artifacts/browser-review/p3-2026-10-18-final/redacted-services.log)
- [Main localhost smoke](../artifacts/browser-review/p3-2026-10-18-main/results.json)
- [Desktop applicability matrix](../artifacts/browser-review/p3-2026-10-18-final/p3/applicability-desktop.png)
- [Native calculation traces](../artifacts/browser-review/p3-2026-10-18-final/p3/native-calculation-traces.png)
- [Type-evaluation series](../artifacts/browser-review/p3-2026-10-18-final/p3/type-evaluation-two-series.png)
- [Mobile light](../artifacts/browser-review/p3-2026-10-18-final/p3/native-mobile-light.png), [mobile dark](../artifacts/browser-review/p3-2026-10-18-final/p3/native-mobile-dark.png)

Main localhost development frontend: **http://127.0.0.1:3000**. Main production frontend: **http://127.0.0.1:3014**. Backend: **http://localhost:4000**, health `/api/v1/health`. Duplicate development listeners were replaced with one server to avoid sharing a mutable cache. The existing backend development watcher took over port 4000 when the old production backend stopped; its current native API was verified and no second backend was started. Main smoke verified the production assets still load after development compilation. Isolated test services on 3016/4006 stop when the managed run finishes.

## Changed files

- `backend/src/types/native.ts`, `types/domain.ts`, `types/report.ts`: versioned programme, observations/results and report contracts.
- `backend/src/services/NativeApplicability.ts`, `NativeEvaluation.ts`, `NativeAssessment.ts`: profile decisions, native decimal calculations and completeness.
- `backend/src/routes/nativeRoutes.ts`, `app.ts`: authenticated case-scoped routes.
- `backend/src/repositories/index.ts`, `JsonStore.ts`: native collection and durable-write option.
- `backend/src/services/ProgrammeAssessment.ts`, `WorkflowService.ts`: shared fail-closed gate and completed native review submission.
- `backend/src/services/ReportService.ts`, `utils/HtmlGenerator.ts`: native report evidence, traces and seal inputs.
- `backend/tests/nativeProcedures.test.ts`: calculation, profile, storage, API, role and workflow regressions.
- `frontend/lib/native.ts`, `components/NativeProgramme.tsx`, `app/(dashboard)/test-cases/[id]/programme/page.tsx`: native forms and results.
- `frontend/app/(dashboard)/test-cases/[id]/workspace/page.tsx`: entry link.
- `frontend/tests/native.test.cjs`, `tsconfig.browser.json`: validation tests and isolated build types.
- `e2e/p3-browser.cjs`, `e2e/p1-browser.cjs`, `e2e/p1-main-smoke.cjs`: real-browser scenarios, nested runner integration, restart and main smoke checks.
- `.gitignore`, README, PROJECT_CONTEXT, ARCHITECTURE, documentation index/calculation/coverage/workflow documents: current status and evidence.

Unrelated pre-existing P0/P1/P2/Business/design modifications remain uncommitted and are not attributed to P3.

## Remaining work and recommended next phase

Implement the mandatory ascending/descending weighing programme (A.4.4.1), initial E0 capture and prescribed load transitions next; then receptor-specific eccentricity and tare procedures. Add the missing technical examination, zero range/controls/tracking, environmental/electronic and approved-type-dependent applicability paths with verified evidence. Only after required coverage is complete should final-approval eligibility expand. Full R76-2 reporting follows verified procedure coverage.

JSON remains a single-process persistence layer without cross-collection transactions. Evidence may commit before a later revision/audit failure; ambiguous-response guards prevent automatic resend, but operators must reload and inspect. Audit storage retains the existing architecture rather than claiming transactional guarantees. Physical calibration validity, actual stability and conditions depend on documented operator evidence. Browser emulation is not physical mobile hardware or exhaustive accessibility certification. No deployment or full compliance claim is made.
