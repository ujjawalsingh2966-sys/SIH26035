# Local browser verification — 16 October 2026

Publication note: raw browser artifacts linked below are retained locally and excluded from Git. See the [published verification summary](verification/2026-10-16/SNAPSHOT_VERIFICATION.md) for selected redacted evidence and fresh snapshot checks. Account-import snippets now use the local demo environment loader instead of publishing passwords.

Actual browser result: **30 PASS, 6 FAIL, 1 BLOCKED**. The main technician → reviewer return → technician correction → resubmission → reviewer approval flow completed successfully. An additional record was approved by an Administrator. Six application defects remain; no application fix or business-rule change was made during this verification task.

## Browser, servers and isolation

- Browser: **Chromium 156.0.8078.4**, full Chromium in headless mode, including its actual PDF viewer.
- Automation: the already installed **Playwright 1.64.1**, using `@playwright/test` assertions and real Chromium pages/contexts.
- Frontend: **http://127.0.0.1:3010**.
- Backend: **http://127.0.0.1:4001**.
- Tested workspace: `C:\Users\singu\New folder (2)\SIH26035`, branch `main`. No applicable AGENTS.md was found in the workspace or its ancestors.
- Existing servers on ports 3000 and 4000 were preserved. The verification frontend explicitly targeted port 4001 and used its own `.next-browser-review` cache and `tsconfig.browser.json`.
- Isolated persisted data: `artifacts/browser-review/20261016-final/data/`. The backend was started with DATA_DIR pointing there. The original project `data/` had zero JSON records before/after the run; the browser runner checked the original JSON file inventory and hashes.
- Technician, second-technician, Reviewer and Administrator used the supported development login setup documented in `LABORATORY_REVIEW_WORKFLOW.md`, each in a separate browser context. Credentials were imported at runtime and were not added to the new source, screenshots or telemetry.
- Successful responses came from the real local Express backend. No successful response was mocked. The loading probe delayed and continued a real request; the failed-request probe used Chromium's offline mode.
- All browser application requests were restricted to the two local origins. No external application request occurred. Browser-internal PDF viewer resources were local to Chromium.

The prior user decision allowing Reviewer **and** Administrator approval was already documented. Both roles used Start Review before approval; no override or reopening of approved records was used.

## Evidence

The authoritative completed run is:

`artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/`

Useful artifacts:

- [All scenario results](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/results.json)
- [Redacted network evidence](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/network.json)
- [Redacted browser console](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/console.json)
- [Persisted main record, observations and audit history](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/persisted-main-record.json)
- [Reviewer details screenshot](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/reviewer-details.png)
- [Corrected evaluation screenshot](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/corrected-evaluation-history.png)
- [Approved technician/history screenshot](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/approved-technician-history.png)
- [Downloaded report](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/approved-report.pdf)
- [Report open in Chromium PDF viewer](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/approved-report-open-in-browser.png)
- [Settled form colors and reviewer creation denial](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/supplemental-role-and-theme.json)

Screenshots mask account identifiers and login inputs. Network evidence stores method/path/status without Authorization headers, login payloads or token-bearing responses. No HAR, trace, saved session or video containing credentials was produced.

## Scenario results

Main isolated test case: **`tc_1792133270917`**. Instrument: Browser Verification MAIN, model BV-MAIN, synthetic serial, Class III, Max 15000 g, Min 100 g, e=d=5 g. Laboratory conditions: 20 °C, 50% humidity, 1013 hPa.

The documented initial WEIGHING observation was L=5000 g, I=5005 g, ΔL=3 g, E0=0 g. Saved backend Ec=4.5 g, MPE=5 g, PASS. The correction changed I to 5000 g and ΔL to 2.5 g; backend Ec became 0 g, MPE remained 5 g, PASS. Neither thresholds nor submission validation were changed.

| # | Tested scenario | Result | Evidence / finding |
| --- | --- | --- | --- |
| 1 | Technician signs in through real login UI | PASS | Token/session created; dashboard navigation appeared |
| 2 | Queue loading indicator and empty results | PASS | Real request delayed then continued; `empty-queue.png` |
| 3 | Entered instrument values and placeholders in light/dark themes | PASS | `instrument-light.png`, `instrument-dark.png`; settled colors in supplemental JSON |
| 4 | Metadata labels remain identifiable after values are entered | FAIL | D2: seven inputs have no associated or persistent field labels |
| 5 | Dark-theme headings and checkbox labels remain readable | FAIL | D3: pale foreground on pale mesh |
| 6 | Create isolated instrument and draft case through UI | PASS | Draft persisted in isolated JSON storage |
| 7 | Observation entry blocked in DRAFT | PASS | Entry UI absent; browser-origin POST returned 403; no row persisted |
| 8 | Start Testing and rapid repeated clicks | PASS | TESTING persisted; only one transition request |
| 9 | Save laboratory conditions through UI | PASS | All three values matched persisted JSON |
| 10 | Submit with no observations | PASS | Actual 400 response shown in UI; state stayed TESTING |
| 11 | Invalid observation/evaluation feedback | PASS | Actual 400 `Evaluation failed`; no observation persisted |
| 12 | Valid reading, saved evaluation and duplicate-click guard | PASS | Ec=4.5 g, MPE=5 g, PASS; one POST and one saved row |
| 13 | Reload persistence | PASS | Conditions, readings and saved evaluation remained |
| 14 | Evidence display and download | PASS | Supported API supplied synthetic fixture; actual UI downloaded matching file |
| 15 | Submit for review and technician locks | PASS | READY_FOR_REVIEW; edit controls disappeared; one submit request |
| 16 | Second technician workspace access and observation edit | PASS | Record/observation reads and edit attempt returned 403 |
| 17 | Reviewer queue and record details | PASS | Correct case, instrument, conditions, saved Ec/MPE/verdict and evidence appeared |
| 18 | Start Review; empty/whitespace reason validation | PASS | UNDER_REVIEW; Return disabled for blank/whitespace reason |
| 19 | Return with correction reason; repeated clicks | PASS | RETURNED_FOR_CORRECTION; exact reason retained; one return request |
| 20 | Owning technician feedback and Resume Testing | PASS | Feedback visible; entry stayed locked until Resume; then TESTING |
| 21 | Supported observation correction | PASS | Saved Ec=0 g; audit preserved original 4.5 g evaluation and replacement |
| 22 | Supported observation deletion | PASS | An extra synthetic row was deleted; full deleted evaluation retained in audit |
| 23 | Resubmit corrected record | PASS | READY_FOR_REVIEW; two submission events retained |
| 24 | Reviewer stale tab across a correction cycle | PASS | Actual 409 with visible refresh guidance; record unchanged |
| 25 | Reviewer claims new review and approves | PASS | APPROVED; one approval request/event under repeated clicks |
| 26 | Reload after approval | PASS | Final state, technician locks, feedback and review/audit history retained |
| 27 | Reviewer navigation hides technician creation actions | FAIL | D4: dashboard still exposes New Instrument |
| 28 | Reports navigation | FAIL | D5: `/reports` returns 404 |
| 29 | Browser PDF download, opening and content comparison | PASS | Real approved PDF API downloaded; actual Chromium viewer rendered it; corrected values matched |
| 30 | Second technician report-data access | FAIL | D1: actual report-data response is 200 and discloses first technician's record |
| 31 | Failed-request feedback and retry | PASS | Browser offline caused visible fetch failure; online retry restored queue |
| 32 | Repeated instrument-create clicks | FAIL | D6: two instrument POSTs and two persisted test cases |
| 33 | Administrator claims and approves a separate case | PASS | Additional isolated record reached APPROVED through UI |
| 34 | Logout and protected navigation | PASS | Token removed; navigating to `/tests` returned to login |
| 35 | Browser runtime errors | PASS | Zero `pageerror` events; HTTP-error console entries are explained below |
| 36 | Local-only traffic and original data preservation | PASS | No external application requests; original file hashes/inventory unchanged |
| 37 | Business application form | BLOCKED | No business application route/form exists in this local checkout |

## Reproduced defects

### D1 — High: report-data endpoint bypasses record ownership

Reproduction:

1. Complete approval of the main isolated case as the owning technician/reviewer.
2. Sign in through the real login page as the different technician.
3. Open `/test-cases/tc_1792133270917/workspace`: the workspace shows access failure and the record/observation APIs return 403.
4. From that same authenticated browser context, request `GET http://127.0.0.1:4001/api/v1/reports/tc_1792133270917/data` with the context's existing Bearer token.

Expected: the report endpoint applies record ownership and returns 403.

Actual: **200**, with the first technician's case ID, approved test details, readings and evaluations. This is a confirmed browser-origin request to the real backend, not a code-only suspicion.

Evidence: [Minimal response proof](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/cross-record-report-probe.json), scenario 30 in `network.json`, and the cross-technician workspace screenshot. The browser probe confirmed the `/data` variant; cross-record `/html` and `/pdf` variants were not independently exercised.

### D2 — Medium: instrument metadata fields lose their names after entry

Reproduction: technician → `/instruments/new` → Continue to Metadata → fill the seven text/numeric fields.

Expected: each field keeps a persistent visible name and an accessible label.

Actual: field names exist only as placeholders. After entry, seven inputs have `input.labels.length === 0` and no aria-label/aria-labelledby. The populated page shows bare values, including two indistinguishable `5` fields for e and d.

Evidence: [Populated form screenshot](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/4-fail-metadata-fields-keep-identifiable-labels-after-entering-values.png), plus scenario 4's exact field list in `results.json`.

### D3 — Medium: dark-theme headings and checkbox label have poor contrast

Reproduction: open instrument metadata form, select the browser/OS dark color scheme, and inspect the page heading, step heading and Equipped with Tare device label.

Expected: readable text throughout the supported dark theme.

Actual: light text is drawn over the unchanged pale purple/yellow mesh. The heading's foreground is `rgb(241,245,249)`; contrast against the mesh base `rgb(250,245,255)` is approximately **1.02:1**. This numeric measurement uses the base color; the screenshot establishes the actual gradient appearance. Input values themselves remain readable on dark input backgrounds.

Evidence: [Actual dark form](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/dark-heading-and-checkbox-contrast.png), `dark-heading-colors.json`, and the light/dark comparison screenshots.

### D4 — Low: reviewer dashboard offers a prohibited creation action

Reproduction: sign in as Reviewer → wait for `/dashboard` to finish loading → click New Instrument → complete metadata → Submit & Initiate Test.

Expected: reviewer navigation exposes actions that role can perform, as the reviewer queue already does.

Actual: New Instrument is visible, opens the technician form and accepts entry; submission is then rejected by the real backend with **403 Forbidden: Insufficient permissions**. The backend permission works; navigation sends the reviewer into a prohibited action.

Evidence: [Reviewer dashboard](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/27-fail-reviewer-navigation-restricts-technician-creation-actions.png), [denied form screenshot](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/supplemental-role-denied-light.png), and `supplemental-role-and-theme.json`. The supplemental probe produced no instrument/test-case mutation because the server rejected it.

### D5 — Medium: Reports link opens a missing route

Reproduction: sign in as Reviewer → click the sidebar Reports link.

Expected: a report screen or supported download path for available approved records.

Actual: `/reports` returns **404**, displaying “This page could not be found.” The laboratory workspace has no report-download button either. The approved report API does work when invoked by the authenticated browser, as the separate PDF test demonstrates.

Evidence: [404 screenshot](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/28-fail-reports-navigation-opens-an-available-report-screen.png), and GET `/reports` 404 entries in `network.json`.

### D6 — Medium: rapid create clicks produce duplicate records

Reproduction: technician → `/instruments/new` → complete valid synthetic metadata → rapidly click Submit & Initiate Test twice. The automated reproduction dispatches two actual button clicks in the same browser turn.

Expected: one instrument creation request and one resulting test case.

Actual: **two POST `/api/v1/instruments` requests**, with two resulting test-case creations and **two persisted cases** for Browser Verification DUPLICATE-PROBE. The main workflow action guards did prevent duplicates; the instrument creation handler did not.

Evidence: [Resulting workspace screenshot](../artifacts/browser-review/20261016-final/attempt-2026-10-16T06-47-35-451Z/32-fail-repeated-instrument-creation-clicks-do-not-create-duplicate-mutations.png), scenario 32 request/response entries in `network.json`, and the isolated instruments/testCases JSON files. No existing user record was involved.

## Console and network interpretation

- **Zero uncaught application runtime/page errors.**
- 13 console error entries were retained. They correspond to deliberate 400 validation probes, 403 access/lock probes, the stale-tab 409, the real Reports 404, and the deliberate offline fetch failure.
- Request failures also include Next client-navigation/prefetch cancellations (`net::ERR_ABORTED`). No successful mutation was inferred from these canceled navigation requests.
- Unexpected confirmed network findings: Reports 404, cross-record report-data 200, duplicate creation POSTs. The supplemental reviewer-create 403 is expected authorization behavior but exposes the navigation defect.
- Login request bodies, JWTs and Authorization headers are omitted from the telemetry. No response was replaced with a mocked success.

## Commands and results

Executed from the existing repository root. These are the final server commands; the separate original 3000/4000 servers were not stopped:

```powershell
$env:PORT='4001'
$env:CLIENT_URL='http://127.0.0.1:3010'
$env:DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\20261016-final\data'
npm.cmd run dev --workspace backend
```

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4001'
$env:W8LAB_BROWSER_BUILD_DIR='.next-browser-review'
npm.cmd run dev --workspace frontend -- --hostname 127.0.0.1 --port 3010
```

Runtime account import used the already documented development setup without copying credentials into new source:

```powershell
. .\e2e\local-staff-env.ps1
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\20261016-final'
node e2e/laboratory-browser.cjs
```

Final browser command: **exit 1**, intentionally reflecting **30 PASS / 6 FAIL / 1 BLOCKED**; the process completed and wrote its results. This is a finding-bearing test run, not an execution blocker. For a rerun, choose a **new empty run directory** for both backend DATA_DIR and W8LAB_BROWSER_RUN_DIR; do not clear an existing dataset.

Additional checks:

| Command/check | Result |
| --- | --- |
| `node --check e2e/laboratory-browser.cjs` | PASS |
| `git diff --check` | PASS |
| Chromium `about:blank` launch diagnostic | PASS after permitted execution |
| Supplemental browser probe of reviewer-create denial and settled theme colors | Exit 0; 403 confirmed; dark input text/background/placeholder colors confirmed |
| Browser PDF viewer frame diagnostic | Actual Chromium extension frame identified; final viewer assertion passed |
| Credential/token scan of 13 new source/text artifacts | PASS; no documented account values, password or JWT found |

The first sandboxed Chromium launch returned **`browserType.launch: spawn EPERM`**. Retrying with the required local execution permission succeeded. No browser installation was needed. Earlier exploratory runs identified selector issues (Next's extra alert, duplicated evidence filename in audit, PDF viewer in an extension frame) and a mistaken report-status expectation (report presentation status is FINAL, while the test case is APPROVED). Those test checks were corrected; the authoritative final run is linked above. The form color probe was additionally repeated after its CSS transition settled; those settled values are in the supplemental artifact. Application behavior was not changed to make tests pass.

## Files added or changed for this verification

- Added `e2e/laboratory-browser.cjs`: reusable local browser scenarios, DOM interactions, guarded local origins, screenshot redaction, sanitized console/network evidence and persisted-state checks.
- Added `frontend/next.config.js`: selects an independent cache and browser-test TypeScript config only when W8LAB_BROWSER_BUILD_DIR is set; normal startup retains `.next` and the existing TypeScript configuration.
- Added `frontend/tsconfig.browser.json`: prevents the isolated Next dev server from editing the existing tsconfig file.
- Updated `.gitignore`: ignores the browser build cache and local evidence/data artifacts.
- Added this report.

The root package.json/package-lock.json Playwright changes were already present when this task began and were preserved. Existing product source changes were preserved. A transient automatic Next edit to `frontend/tsconfig.json` was restored; it has no content diff. No commit, push, PR, merge or deployment was performed.

## Untested or limited scenarios

- Business application form: blocked because this checkout contains no such form/route.
- Evidence upload through UI: unavailable; the evidence fixture used the existing authorized API from the browser, then UI display/download was verified.
- Report download through product UI: unavailable because the Reports route is broken and the workspace has no report button. Authenticated browser API download and actual PDF viewing were completed.
- Cross-record report `/html` and `/pdf` variants were not independently exercised; `/data` disclosure is confirmed.
- Only Chromium desktop was used; Firefox, WebKit, mobile viewports, browser autofill and assistive-technology sessions were not exercised.
- Submission completeness/metrology policy was kept as implemented. One evaluated observation satisfies the existing gate; no extra completeness or verdict rule was assumed.

Suggested follow-up order, after these recorded reproductions: restore record authorization on report reads, prevent duplicate creation, repair Reports navigation, then correct dark-theme text and persistent labels/role navigation. These are proposed follow-up changes, not fixes performed in this verification task.
