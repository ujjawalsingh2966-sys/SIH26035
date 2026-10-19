# W8LAB P3.1: Validation and test-purpose dispatch repair

18 October 2026. SIH26035. **P3.1 implementation and verification complete locally. The failed P4 prerequisite checks now pass. P4A was not implemented.** Native final approval remains blocked by the remaining mandatory coverage gaps documented in P3/P4.

## Root causes and affected paths

The original `validateProfile()` checked string-coerced purpose, indication and load receptor values, then retained the original JSON. Arrays and nested arrays containing a supported-looking value could pass validation but fail downstream strict string comparisons. This selected verification sampling for a malformed type-evaluation purpose and enabled zero accuracy for a malformed service-inspection purpose.

The audit identified these dependent paths:

| Boundary / consumer | Previous issue | Repair |
| --- | --- | --- |
| Programme profile API and direct builder | Three enum checks used `String(input.field)`; raw input was cast to `NativeProfile` | Primitive-string membership checks and explicit validated object construction |
| Repeatability / applicability dispatch | Any value unequal to TYPE_EVALUATION fell into the verification branch | Validated, exhaustive policy for the three supported purposes |
| Zero dispatch / MPE context | Arrays unequal to IN_SERVICE_INSPECTION enabled the wrong policy | Shared validated policy for applicability, case context and native MPE dispatch |
| Stored JSON and native evaluator | Deserialization relied on TypeScript types; stored decisions were trusted | Revalidate profile, provenance/version, frozen instrument fingerprint and canonical decisions before evaluation |
| Completeness aggregation | An invalid/empty decision list could crash or infer N/A through an empty `every()` | Invalid programmes yield INCOMPLETE/UNDETERMINED; missing core decisions never imply N/A |
| Generic observation routes on invalid native cases | Generic entry/correction could still evaluate despite the invalid native programme | Create/update/delete reject with 409; start/resume and review submission also block invalid declarations |
| Generic observation/evidence/lifecycle enum validators | `isIn()` implicitly handled array elements without first requiring a primitive string | `isString().bail().isIn(...)` for laboratory testType/status fields |
| Direct generic calculation dispatch | Object-key lookup coerced array-valued testType to a supported key | Primitive-string and own-key checks before calling calculation/rule engines |
| Programme UI and reports | Rendering could access malformed stored profile fields | Safe read projection/error state; reports use assessed metadata, retain raw history and cannot become FINAL |

The relevant laboratory audit also checked mass units, accuracy-class selection, zero-device entries and staff-role membership. Their existing strict membership/type guards were reused. `MasterDataService`'s remaining numeric `String(input.n)` check also requires a real string before acceptance, so it did not have this enum bypass. Presentation escaping/string formatting is not enum validation. No unrelated Business workflow or rule-table redesign was performed.

All malformed enum types are rejected: arrays, nested arrays, objects, boxed strings in direct calls, null, numbers, booleans, missing/empty strings and unsupported strings. `UNKNOWN` remains an explicit supported string only for indication/receptor; it does not mean a default purpose. Zero-device inventory retains its defined array-or-null contract, with each member independently validated as a primitive supported mechanism.

## Purpose-specific sampling and limits

Primary references: [OIML R76-1:2006](https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf), A.4.10/3.6.1 and A.4.2.3/4.5.2, and [R76-2:2007](https://www.oiml.org/en/files/pdf_r/r076-2-e07.pdf) section 5 reporting context. This repair adds no new formula, load tolerance or acceptance threshold.

| Supported primitive purpose | Repeatability sampling | Limit / zero policy |
| --- | --- | --- |
| TYPE_EVALUATION, Max <1000 kg | Two series: half/near Max; 10 readings each | Initial MPE context; supported declared zero-accuracy mechanisms remain available |
| TYPE_EVALUATION, Max >=1000 kg | Same two series; at least 3 readings each | Same existing policy |
| INITIAL_VERIFICATION | One about-80% series: class II 6 readings; III/IIII 3 | Initial MPE context |
| IN_SERVICE_INSPECTION | Separate verification-pattern repeat series under existing scope | Existing doubled repeat MPE; zero accuracy remains explicitly UNSUPPORTED pending verified service-zero policy |
| Malformed, missing or other purpose, including SUBSEQUENT_VERIFICATION | Rejected before constructing a plan | No fallback, saved programme or evaluation |

P3's exact nominal 50%/100%/80% load selections remain a deliberately narrower application profile. The standard's approximate-load language has not been replaced with an invented numeric tolerance. Subsequent verification is not silently treated as service inspection. Classes I/auxiliary/grading/multi-range/analog/mechanical native evaluation remain outside the existing supported profile.

Decimal unit normalization, Table 6 boundaries, changeover P/E, repeat spread and zero 0.25e comparisons are unchanged. `W8LAB-R76-2006-P3-1` remains the calculation ruleset because valid calculation semantics did not change. Existing valid programme objects and result/input fingerprints are not rewritten. Validation logic was repaired, not historical results recalculated.

## API and historical-data behavior

| Operation | Result |
| --- | --- |
| Invalid new profile enum | 400, clear field-specific error, no programme/revision/evidence/audit mutation |
| Unauthorized/cross-user request | Existing 401/403 policy remains authoritative before protected data is exposed |
| Valid profile for an unsupported native procedure | 422 on evaluation; cannot produce PASS |
| Invalid persisted programme | GET remains authorized/readable with `programme:null`, `programmeError` and INCOMPLETE/UNDETERMINED assessment |
| Native evaluation, programme overwrite, generic observation mutation or review submission on invalid persisted programme | 409 with explicit invalid-history error; no automatic correction or reinterpretation |
| Invalid persisted programme at approval | Shared gate rejects approval; cannot produce overall PASS or FINAL |
| Pre-existing APPROVED malformed-history fixture | Authorized data/HTML/PDF remains available as PROTOTYPE / INCOMPLETE, with validation errors and original stored traces |

The GET view suppresses the invalid programme from interactive form dispatch; the authorized raw case/history is retained in storage and report data. Saved individual PASS/FAIL traces are historical evidence, not trusted current compliance for an invalid declaration. Reports use the safe assessed heading/matrix rather than dereferencing malformed profile fields. Existing report-download audit entries still append normally; earlier audit records and case/observation bytes remain intact.

The programme screen shows a persistent blocking alert with a workspace link and no native write controls. No automatic repair/migration UI was introduced. Remediation of malformed real records requires an explicit reviewed policy; this phase only detects and blocks them.

Read-only operator audit:

```powershell
npm.cmd run build --workspace backend
npm.cmd run native:audit --workspace backend
# Optional explicit DATA_DIR uses the same existing persistence convention.
```

`native:audit` prints counts and invalid case IDs/reasons, never account credentials or full records. Exit 0 means no invalid native programme was found, 2 identifies invalid programmes, and 1 indicates unreadable storage. No records are rewritten, reset or deleted.

Actual scans:

- Main project DATA_DIR: no `testCases.json`, 0 cases/native programmes; no malformed historical native record to migrate. Existing accounts/signing-key JSON hashes remained unchanged.
- Previous P3 verified browser snapshot: 18 cases, 4 native programmes, 0 invalid. Demonstrates compatibility with pre-repair saved valid programmes.
- New P3.1 isolated fixture dataset: 27 cases, 12 native programmes, exactly 6 intentionally malformed historical fixtures detected; exit 2. Every JSON file hash was unchanged by the audit.

The last scan is synthetic verification evidence, not a claim that six real project records were damaged. The managed runner installs these fixtures only while its own isolated backend is stopped. Its legacy APPROVED fixture tests protected report compatibility, not successful native approval.

## Verification

Before production changes, the original prerequisite suite reproduced **1 PASS / 4 FAIL**. The first expanded validation suite reproduced **33 PASS / 20 FAIL**. A later focused audit of implicit laboratory enum coercion reproduced **23 PASS / 10 FAIL** (54 other tests intentionally excluded by that command's name filter). These red-phase artifacts are retained. Original rejection expectations were not weakened or removed.

Final results:

| Check | Actual result |
| --- | --- |
| Full backend | **523 PASS / 0 FAIL**, 22 suites, 38.538 s |
| Expanded validation/history/laboratory enum tests | **87 / 0**, included in full backend |
| Original P4 prerequisite suite | **5 / 0**, including all four previously failing checks |
| Native calculation/sampling suite | **37 / 0**, included in full backend |
| Focused three-suite total | **129 / 0**, not additive to full backend |
| Frontend | **39 PASS / 0 FAIL** |
| Backend/frontend standalone TypeScript | Both PASS |
| Backend, isolated frontend and main frontend production builds | All PASS |
| P3.1 Chromium scenarios | **10 PASS / 0 FAIL / 0 BLOCKED** |
| Existing P3 browser scenarios | **17 / 0 / 0** |
| Existing P2 browser scenarios | **16 / 0 / 0** |
| Existing full laboratory browser runner | **40 / 0 / 0** |
| Existing P0 integrity browser runner | **6 / 0 / 0** |
| Existing instrument overlap/lost-response runner | **9 / 0 / 0** |
| Managed staff/P0-P3.1 wrapper | **25 / 0 / 0**; includes nested-runner checks, not additive |
| Main localhost browser smoke | **6 / 0 / 0** |
| `git diff --check` | PASS, existing LF/CRLF advisories only |

The browser used real persisted staff credentials provisioned through supported Administrator bootstrap and actual staff UI. It exercised the actual declaration form with deliberately malformed outgoing fields, verified real backend rejections/no writes, retained user-entered fields and completed a valid retry with the correct two ten-reading series. It also verified service repeat MPE=15 g versus initial 7.5 g for the class III 12000 g example, unsupported service zero rejection, generic enum guards, history errors, cross-user controls, approval rejection, prototype HTML/PDF, keyboard focus and mobile light/dark reduced-motion layouts.

There were **0 uncaught browser exceptions, 0 failed JS/CSS assets and 0 unexpected console errors**. The 31 console resource errors in the focused P3.1 run are recorded deliberate 400/403/409/422 rejection probes, not application exceptions. The redacted service log had no unexpected unhandled/type/storage/bind errors; expected validation/authentication warnings remain visible.

The initial P3.1 browser attempt found an ambiguous alert locator (Next's route announcer also has role=alert) and an incorrect expectation that report downloads would not append their established audit entries. The corrected tests target the application's alert and verify immutable prior audit entries plus exactly two REPORT_GENERATED events. The final full runner passed with the actual behavior and all prior protection assertions retained.

Exact commands:

```powershell
npm.cmd test --workspace backend -- --runInBand tests/nativeValidation.test.ts tests/p4PrerequisiteAudit.test.ts tests/nativeProcedures.test.ts --coverage=false --silent --json --outputFile=../artifacts/browser-review/p3-1-focused-final-results.json
npm.cmd test --workspace backend -- --runInBand --coverage=false --silent --json --outputFile=../artifacts/browser-review/p3-1-backend-final-results.json
npm.cmd test --workspace frontend
npm.cmd run build --workspace backend
node node_modules/typescript/bin/tsc --noEmit --incremental false -p backend/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json

$env:W8LAB_BROWSER_BUILD_DIR='.next-p3-review'
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4006'
npm.cmd run build --workspace frontend
$env:W8LAB_BROWSER_P2='1'
$env:W8LAB_BROWSER_P3='1'
$env:W8LAB_BROWSER_P3_1='1'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/p3-1-2026-10-18-verified'
node e2e/p1-browser.cjs
# Repeats require a NEW run directory; never overwrite a prior dataset.

# Main build in a fresh terminal, using normal .env.local API configuration:
npm.cmd run build --workspace frontend
$env:W8LAB_MAIN_SMOKE_DIR='artifacts/browser-review/p3-1-2026-10-18-main'
$env:W8LAB_MAIN_SMOKE_P2='1'
$env:W8LAB_MAIN_SMOKE_P3='1'
node e2e/p1-main-smoke.cjs
git diff --check
```

The production cache is rebuilt only while its preview is stopped. Main preview/backend restarted locally at `http://127.0.0.1:3014` / `http://localhost:4000`; development remains available at port 3000. Main account provisioning is still operator-managed, not automatically created by tests. Main smoke verifies assets/cache isolation and unauthorized access, while valid-role workflows use isolated accounts. Managed 3016/4006 test services stop after the run.

Evidence and screenshots:

- [Full backend results](../artifacts/browser-review/p3-1-backend-final-results.json), [focused tests](../artifacts/browser-review/p3-1-focused-final-results.json)
- [Original failing prerequisite reproduction](../artifacts/browser-review/p3-1-before-results.json), [expanded red phase](../artifacts/browser-review/p3-1-expanded-before.json), [laboratory enum red phase](../artifacts/browser-review/p3-1-laboratory-enums-before.json)
- [Managed browser results](../artifacts/browser-review/p3-1-2026-10-18-verified/results.json), [focused P3.1 results/console record](../artifacts/browser-review/p3-1-2026-10-18-verified/p3-1/results.json)
- [Redacted service log](../artifacts/browser-review/p3-1-2026-10-18-verified/redacted-services.log), [main smoke](../artifacts/browser-review/p3-1-2026-10-18-main/results.json)
- [Valid type programme](../artifacts/browser-review/p3-1-2026-10-18-verified/p3-1/valid-type-programme.png), [invalid history desktop](../artifacts/browser-review/p3-1-2026-10-18-verified/p3-1/invalid-history-desktop.png)
- [Mobile light](../artifacts/browser-review/p3-1-2026-10-18-verified/p3-1/invalid-history-mobile-light.png), [mobile dark](../artifacts/browser-review/p3-1-2026-10-18-verified/p3-1/invalid-history-mobile-dark.png)

## Changed files

| Files | Change |
| --- | --- |
| `backend/src/types/native.ts` | Runtime enum constants and derived TypeScript types |
| `backend/src/services/NativeApplicability.ts` | Strict profile projection, exhaustive policy, shared canonical decisions and non-mutating persisted-programme validation |
| `backend/src/services/NativeEvaluation.ts` | Validate stored programme before dispatch and use explicit purpose/MPE policy |
| `backend/src/services/NativeAssessment.ts`, `ProgrammeAssessment.ts` | Safe invalid-history assessment and no empty-list N/A inference |
| `backend/src/routes/nativeRoutes.ts` | Safe GET error projection, blocked historical overwrite and validated case context |
| `backend/src/services/WorkflowService.ts` | Invalid programme blocks start/resume/review submission; final gate preserved |
| `backend/src/routes/observationRoutes.ts`, `evidenceRoutes.ts`, `testCaseRoutes.ts` | Strict laboratory enum API checks and invalid-history observation mutation protection |
| `backend/src/services/EvaluationService.ts` | Strict direct generic test-type dispatch; formulas unchanged |
| `backend/src/services/ReportService.ts`, `utils/HtmlGenerator.ts` | Safe assessed report metadata and preserved prototype warnings/history |
| `backend/src/cli/nativeProfileAudit.ts`, `backend/package.json` | Read-only persisted-programme audit command |
| `backend/tests/nativeValidation.test.ts` | Expanded enum, dispatch, mutation, history, reports and safety regressions |
| `frontend/lib/native.ts`, `frontend/components/NativeProgramme.tsx` | `programmeError` contract and blocking historical error state |
| `e2e/p1-browser.cjs`, `p3-1-browser.cjs`, `p3-1-isolated-history.cjs` | Managed browser hook, actual form/API scenarios and isolated historical fixtures |
| README, PROJECT_CONTEXT, ARCHITECTURE, documentation index, P3/P4 and calculation documentation | Current verified status, validation contracts and readiness |

The existing `p4PrerequisiteAudit.test.ts` rejection assertions were preserved. Unrelated pre-existing work, including current interface changes, belongs to the user and was not reverted. No credentials, records, database migrations, commits, pushes or deployments were added to the main dataset.

## UI review and limitations

The small error-state addition follows the existing interface's persistent text, accessible alert, themes and focus behavior. No unrelated redesign or measurement-entry animation was added.

| Before | After | Why |
| --- | --- | --- |
| Invalid stored profile could enter form dispatch or crash a renderer | Clear blocking alert with no native write controls | Preserve history and explain the actionable state |
| Invalid decisions could look absent/N/A | Explicit INCOMPLETE/UNDETERMINED assessment | Prevent false technical completion |
| Reports dereferenced raw malformed profile metadata | Assessed heading and validation issues with unchanged raw traces | Retain history without implying a verified result |

Remaining limits: exact nominal repeat-load restriction, unsupported service-zero interpretation, limited instrument configurations, incomplete mandatory technical/environmental/electronic procedures and full R76-2 reporting remain as documented. JSON storage still assumes one backend writer and is not a cross-collection transaction system. Fingerprints are integrity checks, not statutory signatures. No automatic repair policy for malformed real historical records is introduced. Browser checks use Chromium/emulated narrow layouts, not all engines or physical devices.

P4A's P3 validation/dispatch prerequisites now pass. The next authorized development phase can begin with the full configuration-specific P4 coverage matrix and incremental P4A implementation. This run stops at P3.1 and does not claim P4 completion or full OIML conformity.
