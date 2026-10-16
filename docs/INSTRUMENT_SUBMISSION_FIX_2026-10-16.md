# Instrument submission fix — 2026-10-16

Publication note: raw browser artifacts linked below are retained locally and excluded from Git. See the [published verification summary](verification/2026-10-16/SNAPSHOT_VERIFICATION.md) for selected redacted evidence and fresh snapshot checks. Account-import snippets now use the local demo environment loader instead of publishing passwords.

Implemented and verified in the existing local checkout. No backend code or business rules changed in this task. Existing report authorization and laboratory review/correction/approval changes remain in place. Nothing was committed, pushed, merged or deployed.

## Reproduction and cause

Before editing, Chromium submitted two rapid clicks on the real instrument form against the existing isolated services. Both instrument POSTs started at the same relative millisecond (518 ms); both returned HTTP 201 at 526/527 ms. Two test-case POSTs followed at 528 ms and both returned 201. Disk inspection confirmed two instruments and two associated test cases. Navigation landed in the second workspace.

The creation handler had no synchronous in-flight guard. Each click independently executed instrument creation, test-case creation and navigation. No duplicate handler registration or automatic request retry was observed. The backend has no creation idempotency support to reuse.

Reproduce the old behavior: sign in as the isolated technician, open `/instruments/new`, complete the classification and valid metadata, then invoke the submit button twice rapidly. Expected: one instrument and one case. Before fix: two of each.

Before-fix evidence: [request timing and persisted IDs](../artifacts/browser-review/instrument-submit-20261016/reproduction/before-fix.json), [browser screenshot](../artifacts/browser-review/instrument-submit-20261016/reproduction/duplicate-created-before-fix.png). Existing duplicates were retained.

## Changes

- `frontend/app/(dashboard)/instruments/new/page.tsx`: native form submission handles clicks and Enter. A ref closes the overlap window synchronously at handler entry, before React renders disabled controls. Busy text stays visible and fields, Back and Submit remain disabled until the operation completes or fails.
- Confirmed pre-save API rejections restore retry and preserve entered values. After an instrument is saved, its ID is retained in the mounted form; a confirmed test-case rejection offers `RETRY TEST CASE` and reuses that instrument. Saved metadata is locked. A known saved case can be opened without another POST.
- An unreadable, lost, timeout or unconfirmed server response blocks resend and tells the user to check Instruments/Evaluation Queue. The application does not guess that a write failed. HTTP 4xx with the existing API's explicit `success: false` rejection envelope is retryable, except HTTP 408; transport failures, 5xx and malformed responses are treated as uncertain.
- `e2e/instrument-submission.cjs`: nine focused browser regressions, actual browser request counting, isolated JSON record counting, sanitized evidence and original-data hash checks.
- `e2e/laboratory-browser.cjs`: strengthens the existing duplicate scenario to assert both instrument/test-case request counts and both persisted record counts. Other expectations remain intact.
- This document records the handoff. Existing layout, input/theme classes, classification validation, permissions and serial-number behavior were preserved.

## Local execution and isolation

Browser: Playwright 1.64.1, real Chromium 156.0.8078.4 (headless, `channel: 'chromium'`). Frontend: <http://127.0.0.1:3010>. Backend: <http://127.0.0.1:4001>. Both isolated services were left running for local review.

Reproduction first verified the served instrument IDs against the previous isolated `artifacts/browser-review/report-access-20261016/full/data` dataset. Subsequent runs used separate `focused/data` and `full/data` directories under `artifacts/browser-review/instrument-submit-20261016/`. The backend's supported `DATA_DIR` and seed setup were used. The browser verified its served dataset before mutations, restricted traffic to local origins and confirmed the original project JSON data was unchanged. Default application services/storage were preserved.

From the repository root, the service commands used for each isolated dataset were:

```powershell
$env:PORT='4001'
$env:CLIENT_URL='http://127.0.0.1:3010'
# Use focused\data for the focused run, full\data for the full runner.
$env:DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-submit-20261016\full\data'
npm.cmd run dev --workspace backend
```

In another terminal:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4001'
$env:W8LAB_BROWSER_BUILD_DIR='.next-browser-review'
npm.cmd run dev --workspace frontend -- --hostname 127.0.0.1 --port 3010
```

The isolated frontend was stopped for its production build and restarted afterward; its separate build directory preserved the default service's cache. The first focused launch stopped before opening a browser because the starting backend had not yet initialized its isolated data directory. After health/data readiness was confirmed, the focused runner completed successfully.

## Focused browser results

All successful saves below used the real local backend. Delays held and forwarded its unchanged responses. Negative probes changed an outgoing request to provoke real validation failures, or discarded a real response after a committed write; no successful API response was fabricated.

| Scenario | Instrument POSTs | Test-case POSTs | Persisted instruments / cases | Result |
| --- | ---: | ---: | --- | --- |
| Rapid clicks plus direct native form submits | 1 | 1 | 1 / 1 | PASS |
| Enter plus click/form submissions, delayed real case response | 1 | 1 | 1 / 1 | PASS |
| Delayed real instrument response, pending/disabled controls | 1 | 1 | 1 / 1 | PASS |
| Real HTTP 400, values retained, successful retry | 2 (one rejected) | 1 | 1 / 1 | PASS |
| Instrument saved; real case HTTP 404; retry saved instrument | 1 | 2 (one rejected) | 1 / 1 | PASS |
| Two legitimate successive instruments with the same synthetic serial | 1 each | 1 each | 1 / 1 each | PASS |
| Instrument HTTP 201 discarded after commit; resend prevented | 1 | 0 | 1 / 0 | PASS |
| Case HTTP 201 discarded after commit; resend prevented | 1 | 1 | 1 / 1 | PASS |
| Existing out-of-scope classification validation | 0 | 0 | 0 / 0 | PASS |

Failure injection details: the 400 probe replaced only the outgoing instrument name with an empty string; the original UI values remained intact. The 404 probe replaced only the outgoing case's instrument ID with a missing synthetic ID. Retrying forwarded the original valid inputs to the backend. Lost-response probes waited for a real HTTP 201 before aborting delivery to the page.

Focused evidence directory: [results](../artifacts/browser-review/instrument-submit-20261016/focused/submission-2026-10-16T07-31-46-526Z/results.json), [network](../artifacts/browser-review/instrument-submit-20261016/focused/submission-2026-10-16T07-31-46-526Z/network.json).

Screenshots: [pending save](../artifacts/browser-review/instrument-submit-20261016/focused/submission-2026-10-16T07-31-46-526Z/slow-response-pending.png), [validation failure preserves values](../artifacts/browser-review/instrument-submit-20261016/focused/submission-2026-10-16T07-31-46-526Z/confirmed-rejection-values-preserved.png), [saved instrument retry](../artifacts/browser-review/instrument-submit-20261016/focused/submission-2026-10-16T07-31-46-526Z/partial-save-retry-test-case.png), [uncertain instrument outcome](../artifacts/browser-review/instrument-submit-20261016/focused/submission-2026-10-16T07-31-46-526Z/unknown-instruments-no-resend.png), [uncertain case outcome](../artifacts/browser-review/instrument-submit-20261016/focused/submission-2026-10-16T07-31-46-526Z/unknown-test-cases-no-resend.png). Login inputs and the account identity were masked.

## Commands and results

Credentials were read into environment variables from the existing local account guide, without adding credentials to this runner, screenshots or report. Focused command:

```powershell
. .\e2e\local-staff-env.ps1
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-submit-20261016\focused'
node e2e/instrument-submission.cjs
```

Result: **9 PASS, exit 0**, no browser page errors; original project data unchanged.

Full runner account setup and command (after starting the backend with `full/data`):

```powershell
. .\e2e\local-staff-env.ps1
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-submit-20261016\full'
node e2e/laboratory-browser.cjs
```

Executed once after the fix: **32 PASS / 4 FAIL / 1 BLOCKED, exit 1**. Previously 31 / 5 / 1. Report-access restrictions, correction/resubmission/approval, retained history, PDF and the strengthened rapid-creation scenario all passed. No browser page errors. Expected negative-probe failures and the existing Reports 404 remain in the network evidence.

Full evidence: [results](../artifacts/browser-review/instrument-submit-20261016/full/attempt-2026-10-16T07-35-52-713Z/results.json), [network](../artifacts/browser-review/instrument-submit-20261016/full/attempt-2026-10-16T07-35-52-713Z/network.json), [console](../artifacts/browser-review/instrument-submit-20261016/full/attempt-2026-10-16T07-35-52-713Z/console.json), [request and persisted-ID summary](../artifacts/browser-review/instrument-submit-20261016/full/attempt-2026-10-16T07-35-52-713Z/duplicate-submission-counts.json). The latter records **one instrument POST, one case POST, one saved instrument and one saved case**.

Other checks:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4001'
$env:W8LAB_BROWSER_BUILD_DIR='.next-browser-review'
npm.cmd run build --workspace frontend
node --check e2e/instrument-submission.cjs
node --check e2e/laboratory-browser.cjs
git diff --check
```

All passed (exit 0); production build compiled, checked types/lint and generated all nine pages. Backend tests/build were not rerun for this frontend-only change; the real backend was exercised by both browser runners.

## Remaining defects and limits

The four full-run failures are unchanged and intentionally out of scope: persistent metadata labels, dark-theme heading/checkbox contrast, reviewer creation navigation and the Reports link returning 404. The absent business application route remains BLOCKED. Their existing reproductions remain in `docs/BROWSER_VERIFICATION_2026-10-16.md` and current screenshots/results above. No business application route was added.

This is protection within one mounted form, not backend idempotency. Independent tabs, direct API clients and fresh/reloaded forms do not share its guard or saved-ID checkpoint. After a confirmed partial success, keep the form open to retry the saved instrument's case; after a reload, inspect existing records before starting again. No serial-number uniqueness rule or record deletion was introduced.

An ambiguous response cannot be reconciled automatically because this backend has no idempotency key or operation receipt lookup. This form therefore refuses another POST and provides inspection links. It adds no timeout; a request that has not resolved remains pending. Cross-tab concurrency and recovery across reloads are not claimed as solved. No permission conflict was found for this change.
