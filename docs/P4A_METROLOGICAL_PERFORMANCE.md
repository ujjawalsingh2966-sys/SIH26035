# W8LAB P4A — partial implementation, verification blocked

19 October 2026. SIH26035. **P4A is NOT complete. Do not promote these changes as verified metrological coverage or full OIML compliance.**

The initial mandatory automated gate passed before P4A production edits: **523 backend tests / 22 suites** and **39 frontend tests**. This includes the original five prerequisite checks, strict primitive enums/array/object rejection, correct type-evaluation repeat sampling, unsupported service-zero rejection, invalid-history guards and native final-approval rejection. The P3.1 report was read; its historical results were not substituted for these fresh tests.

Later real-browser verification exposed a recurring staff-persistence prerequisite failure. Following the brief's stop rule, implementation was stopped. Authentication/storage production code was not changed to work around it. The additional code below remains local, opt-in and only partially verified. Existing P3 programme creation remains the default; saved native evidence cannot be upgraded or reinterpreted.

## Blocking evidence and investigation

Three fresh, isolated managed Chromium attempts were made. Attempts 1 and 3 failed Administrator provisioning through the actual staff form with **HTTP 503**, accompanied by `Staff persistence failed: rename EPERM`. The existing strict `JsonStore` successfully writes `staffAccounts.json.tmp`, but Windows rejects its replacement of `staffAccounts.json`. Non-sensitive metadata showed ordinary Archive attributes, not a read-only file. The underlying handle/ACL/security-tool cause is **not established**; it must not be asserted to be antivirus or “just a network error”.

The existing store rolls back its in-memory account creation and returns an accurate storage-unavailable failure. No password bypass, alternate identity store, weaker persistence, arbitrary account acceptance or production retry workaround was added. Main data was not used for provisioning.

Attempt 2 passed staff provisioning and all prior nested regressions, but its P4A declaration failed an exact dropdown-label lookup. The form was visible; nested option text interfered with its accessible name. Explicit accessible names were added. Subsequent review also made the positive-load plan conservative and checked printer/function inventory consistency. **These latest form repairs have not passed a fresh browser run**, because attempt 3 failed at staff provisioning first.

After a provisioning failure, the existing runner can hang waiting for a Reviewer login that cannot succeed. Only the inspected failed runner PID/process tree and isolated test services were terminated. Normal project services and files were not targeted. Attempts 1/3 retain redacted live logs but have no completed result tally; they are not successful test runs.

Next authorized prerequisite work: diagnose/reproduce the Windows atomic-replacement failure, preserve durable-write rollback, verify provisioning failure/retry, and make runner prerequisite failure terminate cleanly rather than waiting indefinitely. Then rerun P0–P3.1 and resume P4A browser verification/calculation review. **Do not begin P4B yet.**

## Architecture and preservation

- New opt-in ruleset: `W8LAB-R76-2006-P4A-1`, declared by an additional `performance` object on the existing programme API. No new database or Business workflow.
- P3 `W8LAB-R76-2006-P3-1` canonical decisions and semantics remain versioned separately. Validation selects the corresponding decision builder; no stored programme, input fingerprint, observation, audit entry or result is migrated/recomputed.
- New results reuse existing native storage, Technician ownership/state checks, optimistic revision, correction audit and safe unknown-delivery behavior. Programme declarations freeze after any native evidence. Downgrade of an existing P4A declaration is rejected.
- The assessment recognizes the programme's own supported result version. Unsupported/undetermined/missing requirements remain blocking. Complete FAIL sections can enter review, but do not remove the native final-approval gate.
- Calculations use 100-digit decimal arithmetic and canonical grams. Native repeatability and the four P3 zero mechanisms keep their separate evaluator/purpose policy.
- Reports retain old traces and only add P4A correction/chronology details for P4A records. Historical APPROVED incomplete data remains PROTOTYPE, not newly certified FINAL.

## Clause-by-clause coverage at this stopped handoff

References opened directly: [R76-1:2006](https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf) and [R76-2:2007](https://www.oiml.org/en/files/pdf_r/r076-2-e07.pdf). Exact clauses are recorded with saved decisions/results. R76-2 is a reporting reference, not a claim that all standardized forms are implemented.

`PARTIAL` below means implementation/automated checks exist but P4A browser acceptance and final technical review remain unfinished. It must not be read as `IMPLEMENTED_VERIFIED`. `NOT_APPLICABLE` is a per-instrument justified result, never a replacement for an unfinished evaluator.

| Requirement | Current category | Local implementation and limits |
| --- | --- | --- |
| A.4.1 preparation, A.4.3 zero reference | PARTIAL | Preparation/accuracy confirmations, actual zero determination; not a complete standards/uncertainty/environment examination |
| A.4.2.3, 4.5.2 zero accuracy | IMPLEMENTED_VERIFIED (existing P3 scope) | Existing four mechanisms/purpose limits unchanged; P3/P3.1 regressions pass |
| A.4.2.1/.2 and remaining 4.5 controls | UNSUPPORTED / UNDETERMINED | Range, signaling, tracking rate and operating checks remain independently blocking |
| A.4.4.1/.3 weighing | PARTIAL | Exact nominal ascending/reverse-descending plan, Min/Max/transitions, changeover P/E/E0/Ec, Table 6 MPE and completion |
| A.4.4.2 supplementary weighing | PARTIAL | Declared initial-zero upper limit >20% Max, compensated base load and full sequence; unknown range stays undetermined |
| A.4.4.4 modules / .5 substitution | UNSUPPORTED | Standard-weight whole-instrument path only; neither protocol is silently inferred |
| A.4.5 / 3.6.3 multiple devices | PARTIAL | Paired device readings and independent initial zero/changeover traces; display difference within MPE, digital print equals display |
| A.4.6.1 net weighing | PARTIAL | Subtractive half-maximum-tare configuration; additive nominal third/full configurations; independent net sequences and net-load MPE |
| A.4.6.2 / 4.6.3 tare setting | PARTIAL | Actual post-setting zero/changeover; strict electronic accuracy boundary; combined zero/tare and service policy unsupported |
| A.4.6.3 tare weighing device | PARTIAL | Actual common tare load, independent zero determinations and individual errors; display-comparison limit distinct from printing |
| A.4.7.1, up to four supports | PARTIAL | Four quarter positions, actual sketch reference, disabled automatic devices, fresh zero before each loading |
| A.4.7.2, more than four supports | PARTIAL / UNSUPPORTED | Separate support positions; closely paired supports remain explicitly unsupported |
| A.4.7.3 special receptors | PARTIAL | Each support, declared construction and position/sketch evidence |
| A.4.7.4 rolling | PARTIAL | Beginning/middle/end per section, reverse if declared, fresh zeros; declared heaviest rolling load and capacity bound |
| A.4.7.5 mobile, A.4.13 portable | UNSUPPORTED / UNDETERMINED | Explicit mobile inventory; no mobile operational evaluation or implied N/A |
| A.4.8.2 digital discrimination | PARTIAL / NOT_APPLICABLE | Three-load type test, actual reduction/replacement/1.4d response; existing digital verification and d<5 mg exclusions retained |
| A.4.8.1 analog/non-self indication | UNSUPPORTED | No invented analog displacement evaluator |
| A.4.9 sensitivity | NOT_APPLICABLE / UNSUPPORTED / UNDETERMINED | Only explicit self-indication excludes it; false is unsupported and null remains undetermined. No native non-self-indicating evaluator claimed |
| A.4.10 repeatability | IMPLEMENTED_VERIFIED (existing P3 scope) | Existing tests and real P3 browser 17/0/0 pass; no formula/sampling expansion |
| A.4.11.1 creep | PARTIAL | Actual ordered timestamps, early-exit versus four-hour path, changeover differences and environmental declarations |
| A.4.11.2 zero return | PARTIAL | Zero → Max loading start/end → stable unloaded zero; elapsed loading and return deviation |
| A.4.12 equilibrium | PARTIAL / UNSUPPORTED / UNDETERMINED | Manufacturer/worst-case references, five outcomes per declared function, inhibition and five-second output trace; mobile/automatic-zero variants and verification-purpose gaps remain blocked |
| A.5 influence factors / A.6 endurance | MISSING (native evaluation) | Remain UNSUPPORTED/UNDETERMINED in programme, not covered by P4A time tests |
| A.1–A.3 technical examination, Annex B/C–G applicable coverage | MISSING / PARTIAL metadata | Registration alone is not an examination; residual groups continue blocking final approval |
| Complete R76-2 reporting | PARTIAL | Additional traces/raw evidence are available; prescribed complete reporting and technical acceptance remain later work |

Supported calculation target is deliberately narrow: validated P2 electronic digital self-indicating single-range graduated classes II/III/IIII with d=e. Unsupported Class I, auxiliary/grading, analog/non-self-indicating, mobile, paired-support, combined tare/control or unresolved-purpose variants are not certified. Finite exact nominal targets must fit the supported decimal-entry contract; arbitrary “near” tolerances are not invented.

## Observations, formulas and independent examples

Weighing/net sequences require zero plus at least ten positive nominal loads for type evaluation, or five positive loads for the supported other plan, then their reverse to zero. Counting positive loads in addition to zero is an intentionally conservative application profile, not a claim that the standard mandates eleven distinct type loads. Actual mass entries remain blank in the UI. Stored entry plans contain targets/phase/position metadata only.

Example traces used independently in tests:

| Example | Expected calculation / result |
| --- | --- |
| e=5 g, L=5000 g, I=5000 g, ΔL=1.5 g; zero ΔL=2 g, I=L=0 | P=5001 g, E=1 g, E0=0.5 g, Ec=0.5 g; MPE=5 g, PASS |
| Class III at L=2500 g (500e), zero error 0; I=2505 g, ΔL=5 g | Ec=2.5 g equals MPE, PASS |
| Same load/indication, ΔL=4.999 g | Ec=2.501 g >2.5 g, FAIL |
| Electronic tare setting, e=5 g, zero I=L=0, ΔL=1.25 g | E0=1.25 g, not better than 0.25e: FAIL; ΔL=1.251 g gives 1.249 g: PASS |
| Digital d=5 g | Record I, I−5, replacement 0.5 g, gentle addition 7 g and final I+5; unchanged final response fails |
| Creep e=5 g | Early termination requires strict deviations <2.5 g and 15→30-minute difference <1 g. Equality requires four-hour continuation, not early PASS |
| Zero return e=5 g | Return deviation 2.5 g passes; 2.501 g fails after valid duration/conditions |

Time observations require explicitly entered ISO timestamps with timezone, chronological sequence and no future time. No clock simulator, generated timestamp or duration interpolation is used. Browser/unit fixtures are explicitly **synthetic historical observations**, not claims that a real scale was tested for 30 minutes/four hours. The application cannot itself prove that a technician physically held the load or entered truthful evidence. Environmental checks use recorded samples plus explicit continuous-stability attestations, not hardware acquisition.

## UI review and installed guidance

Used installed `C:/Users/singu/New folder (2)/SIH26035/.agents/skills/emil-design-eng/SKILL.md`; no unrelated prototype/design-system replacement. Procedure-specific forms reuse existing W8LAB surfaces, labels, theme/focus utilities and responsive spacing. Frequent entry actions add no decorative motion.

| Before | After (local, browser acceptance pending) | Why |
| --- | --- | --- |
| Repeat/zero-only observation selector | Per-procedure plans/forms and explicit characteristic declaration | Different experiments cannot be represented by generic rows |
| No receptor position coverage UI | Quarter/support/rolling-section position map and evidence reference | Make omitted positions visible without fabricating placement |
| No native correction/chronology trace view | E0/Ec, phase/time/position and saved raw evidence | Inspect persisted calculation meaning and history |
| Nested select labels included options in exact accessible-name lookup | Explicit matching accessible names | Persistent visible labels and reliable keyboard/automation identification |

## Verification results and exact commands

Final partial-code checks are recorded below; they do not replace the failed browser acceptance gate.

| Check | Result |
| --- | --- |
| Initial P0–P3.1 automated prerequisite | Backend 523 PASS / 0 FAIL, 22 suites; frontend 39 PASS / 0 FAIL |
| New focused backend suites | 80 PASS / 0 FAIL: 69 procedure/validation + 11 real Express API/security/history tests |
| Final full backend | **603 PASS / 0 FAIL**, 24 suites, 22.11 s; includes the 80 new tests |
| Frontend | 54 PASS / 0 FAIL, including 15 P4A blank-input/metadata tests |
| Backend and frontend TypeScript | PASS |
| Backend production build | PASS |
| Isolated frontend production build | PASS, 18 static pages and dynamic programme route |
| Completed browser attempt 2 managed wrapper | 25 PASS / 1 FAIL (P4A nested runner); not additive with nested counts |
| Attempt 2 prior nested browser regressions | Laboratory 40/0/0; P0 6/0/0; retry 9/0/0; P2 16/0/0; P3 17/0/0; P3.1 10/0/0 |
| Attempt 2 focused P4A | 1 PASS / 14 FAIL, mostly cascading from declaration failure; no successful full P4A form acceptance |
| Attempts 1 and 3 | Aborted after recurring staff provisioning 503/rename EPERM; no completed total |
| git diff --check | PASS after removing an added documentation EOF blank line; existing CRLF advisories only |

```powershell
npm.cmd test --workspace backend -- --runInBand --coverage=false --silent --json --outputFile=../artifacts/browser-review/p4a-prerequisite-backend-2026-10-19.json
npm.cmd test --workspace frontend
npm.cmd test --workspace backend -- --runInBand tests/performanceApi.test.ts tests/performanceProcedures.test.ts --coverage=false --silent
npm.cmd test --workspace backend -- --runInBand --coverage=false --silent --json --outputFile=../artifacts/browser-review/p4a-partial-backend-2026-10-19.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p backend/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
npm.cmd run build --workspace backend
$env:W8LAB_BROWSER_BUILD_DIR='.next-p3-review'
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4006'
npm.cmd run build --workspace frontend
$env:W8LAB_BROWSER_P2='1'; $env:W8LAB_BROWSER_P3='1'
$env:W8LAB_BROWSER_P3_1='1'; $env:W8LAB_BROWSER_P4A='1'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/p4a-2026-10-19-attempt3'
node e2e/p1-browser.cjs
# New attempts REQUIRE a new directory; never overwrite preserved evidence/data.
git diff --check
```

Next worker/test processes required elevated subprocess permission after sandbox `spawn EPERM`; reruns with that permission succeeded. This is separate from the backend's later **file rename EPERM** and must not be conflated with it. Next emits its pre-existing non-standard NODE_ENV/TypeScript-plugin advisories. Only the isolated production cache was built; normal production services were not restarted with the unfinished phase.

Evidence: [initial backend gate](../artifacts/browser-review/p4a-prerequisite-backend-2026-10-19.json), [final partial backend](../artifacts/browser-review/p4a-partial-backend-2026-10-19.json), [completed browser wrapper](../artifacts/browser-review/p4a-2026-10-19-attempt2/results.json), [P4A failures](../artifacts/browser-review/p4a-2026-10-19-attempt2/p4a/results.json), [attempt 1 redacted log](../artifacts/browser-review/p4a-2026-10-19-attempt1/live-redacted.log), [attempt 3 redacted log](../artifacts/browser-review/p4a-2026-10-19-attempt3/live-redacted.log), [visible declaration screenshot](../artifacts/browser-review/p4a-2026-10-19-attempt2/p4a/failure-2.png). Screenshots are failed-attempt evidence, not verified final screenshots.

## Files changed in this phase

| Files | Purpose |
| --- | --- |
| `backend/src/services/PerformancePlan.ts` (new) | Strict characteristic declaration, versioned applicability and exact nominal entry targets |
| `backend/src/services/PerformanceEvaluation.ts` (new) | Separate performance calculations, sampling, chronology, conditions and limits |
| `backend/src/types/native.ts` | Additive declaration, observation and trace contracts |
| `NativeApplicability.ts`, `NativeEvaluation.ts`, `NativeAssessment.ts` | Version-aware integration; preserve old canonical decisions/calculations and fail-closed assessment |
| `backend/src/routes/nativeRoutes.ts` | Optional performance declaration and no downgrade/reinterpretation |
| `ReportService.ts`, `HtmlGenerator.ts` | P4A-only correction/chronology/raw-evidence additions |
| `backend/tests/performanceProcedures.test.ts`, `performanceApi.test.ts` (new) | Independent boundaries, units/sampling, API authorization/revisions/history/approval checks |
| `frontend/components/PerformanceForms.tsx` (new) | Procedure-specific declaration, input, positions and trace/history UI |
| `frontend/components/NativeProgramme.tsx`, `frontend/lib/native.ts` | Opt-in integration, blank fields, preserved P3 paths and safe save behavior |
| `frontend/tests/performance.test.cjs` (new) | No fabricated measurements/default applicability and retained input checks |
| `e2e/p4a-browser.cjs` (new), `e2e/p1-browser.cjs` | Focused actual-form runner and optional managed hook; currently failing/unverified |
| README, PROJECT_CONTEXT, index, P3/P4 coverage, calculation/API/programme documentation | Explicit partial/blocked status, actual contracts and evidence |

Main account/signing-key file hashes match their pre-task recorded hashes. The completed managed attempt also passed its original-project JSON preservation assertion. No records were reset, deleted or migrated; no main staff were provisioned. All prior dirty work, including dashboard/login styling, remains local. No commit, push, merge or deployment occurred.

## Remaining work before any completion claim

1. Resolve and verify the recurring Windows staff-persistence prerequisite. Obtain authorization before broadening storage/security changes.
2. Rerun full P0–P3.1 and P4A browser checks after the current accessible-name, sampling and inventory changes. The attempted P4A runner itself still needs review; blocked/cascading scenarios are not proof that each interaction works.
3. Finish independent technical review and expand regression coverage of mixed units across device traces, boundary/purpose inventories, zero/tare stability configurations, large/rational nominal targets and ambiguous-delivery handling.
4. Review completeness of actual sketch/manual evidence, unsupported receptor/indication variants and complete R76-2 reports. Preserve explicit unsupported/undetermined outcomes.
5. Only after P4A acceptance, plan P4B influence testing: tilt, warm-up, temperature, power supply and applicable endurance, based on verified characteristics/clauses. Annex B/electronic/software/module coverage and reporting remain separate later work.
