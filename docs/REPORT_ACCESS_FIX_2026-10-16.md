# Laboratory report access fix — 16 October 2026

Publication note: raw browser artifacts linked below are retained locally and excluded from Git. See the [published verification summary](verification/2026-10-16/SNAPSHOT_VERIFICATION.md) for selected redacted evidence and fresh snapshot checks. Account-import snippets now use the local demo environment loader instead of publishing passwords.

The unauthorized cross-technician laboratory report access is fixed. Full browser results changed from **30 PASS / 6 FAIL / 1 BLOCKED** to **31 PASS / 5 FAIL / 1 BLOCKED**. The correction, resubmission and approval workflow still passes.

## Reproduction and root cause

Before editing, real Chromium 156.0.8078.4 signed in through the existing frontend as two distinct technician accounts. The frontend at http://127.0.0.1:3010 sent requests to the local backend at http://127.0.0.1:4001. Returned instrument IDs matched the prior isolated dataset in `artifacts/browser-review/20261016-final/data`.

For approved fixture `tc_1792133270917`, owner and unrelated technician both received report-data HTTP 200 and the saved corrected Ec=0. The unrelated technician's workspace access was already denied. [Before-fix browser/network proof](../artifacts/browser-review/report-access-20261016/reproduction/browser-before-fix.json).

`reportRoutes.ts` checked authentication through its app mount and allowed role names, but did not apply record ownership. `ReportService` checked existence and APPROVED status, so the status gate allowed an unrelated technician's request.

## Focused changes

- `backend/src/routes/reportRoutes.ts`: added one router-wide `requireTestCaseAccess` guard before all report handlers, reusing `RepositoryService.userHasAccess`. Data, HTML, PDF and implicit HEAD requests now share the existing record policy before generation, content response or audit writes.
- `backend/tests/reportAuthorization.test.ts`: added 44 real HTTP regression tests. Successful responses use genuine evaluated observations and real report generators. Pass-through spies confirm denied requests never invoke generation; audit persistence is checked for no denied-request side effects.
- `e2e/laboratory-browser.cjs`: expanded the existing cross-technician report scenario to data/HTML/PDF, exact safe denial bodies, unchanged audit history and no new report files. Existing permission expectations and other scenarios were retained.
- Added this handoff document. No frontend application code changed.

The owning technician and permitted Reviewer/Administrator access remain authorized. The existing APPROVED-only report gate remains unchanged. Reviewer record visibility continues to follow the shared lifecycle policy. No approval, correction, metrology or certificate policy changed.

## Entry-point audit

| Entry point | Result |
| --- | --- |
| `/api/v1/reports/:testCaseId/data` | Shared record guard added |
| `/api/v1/reports/:testCaseId/html` | Shared record guard added before generation/audit |
| `/api/v1/reports/:testCaseId/pdf` | Shared record guard added before generation/audit/download headers |
| Implicit HEAD variants | Same authorization guard; regression tested |
| `/api/v1/repository/records/:testCaseId` report summary | Already checks the same shared record policy; regression tested |
| Direct report file candidates | No static/report-file serving exists; tested paths return 404 |
| Public QR/certificate lookup | No implementation in this checkout; no related code changed |

HTML/PDF are generated in memory and returned directly. Denied requests do not reach generation and cannot create an accessible artifact. Existing local browser-download artifacts were preserved.

## Actual verification

| Verification | Result |
| --- | --- |
| Focused backend authorization suite | **44/44 PASS**, one suite |
| Complete backend suite | **145/145 PASS**, 12 suites |
| Backend build | PASS |
| Focused real-browser authorization matrix | **65 checks PASS**, exit 0 |
| Full browser runner, run once after fix | **31 PASS / 5 FAIL / 1 BLOCKED**, exit 1 for the five existing defects |
| Browser runtime/page errors in full run | Zero |
| Browser runner syntax and `git diff --check` | PASS |
| Frontend build | Not rerun; no frontend source/configuration changed in this fix |

Focused Chromium verification covered owner, unrelated technician, Reviewer, Administrator and anonymous contexts; approved and draft records; GET/HEAD for data/HTML/PDF; five direct-file candidates. Owner/Reviewer/Admin received 200 for approved reports, unrelated technician 403, anonymous 401. Nonapproved reports retained their existing state restrictions. Denied requests had no report content or download disposition and left audit storage unchanged. [Focused browser matrix and network evidence](../artifacts/browser-review/report-access-20261016/after-fix/focused-browser-authorization.json).

Backend tests additionally cover invalid tokens, unsupported roles, missing records, all five nonapproved lifecycle states, repository summary authorization and direct-file candidates after successful PDF generation.

Full browser run used a new isolated dataset: `artifacts/browser-review/report-access-20261016/full/data`. The existing frontend server was reused after its target backend was verified; the isolated backend was restarted with the new DATA_DIR. Original project records and previous browser evidence were preserved.

Full-run evidence directory:

`artifacts/browser-review/report-access-20261016/full/attempt-2026-10-16T07-12-09-888Z/`

- [All 37 scenario results](../artifacts/browser-review/report-access-20261016/full/attempt-2026-10-16T07-12-09-888Z/results.json)
- [Cross-technician data/HTML/PDF denial proof](../artifacts/browser-review/report-access-20261016/full/attempt-2026-10-16T07-12-09-888Z/cross-record-report-probe.json)
- [Redacted network evidence](../artifacts/browser-review/report-access-20261016/full/attempt-2026-10-16T07-12-09-888Z/network.json)
- [Browser console](../artifacts/browser-review/report-access-20261016/full/attempt-2026-10-16T07-12-09-888Z/console.json)
- [Saved approved record and audit history](../artifacts/browser-review/report-access-20261016/full/attempt-2026-10-16T07-12-09-888Z/persisted-main-record.json)
- [Report open in Chromium](../artifacts/browser-review/report-access-20261016/full/attempt-2026-10-16T07-12-09-888Z/approved-report-open-in-browser.png)

## Exact verification commands

From the existing repository root:

```powershell
npm.cmd run test --workspace backend -- --runInBand tests/reportAuthorization.test.ts --coverageReporters=text-summary --coverageReporters=json
npm.cmd run test --workspace backend -- --runInBand --coverageReporters=text-summary --coverageReporters=json
npm.cmd run build --workspace backend
node --check e2e/laboratory-browser.cjs
git diff --check
```

The affected browser scenario was first verified by a real Chromium probe against the existing isolated services (65 role/state/representation/method/direct-path assertions). The full reusable runner then executed once against fresh isolated storage:

```powershell
$env:PORT='4001'
$env:CLIENT_URL='http://127.0.0.1:3010'
$env:DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\report-access-20261016\full\data'
npm.cmd run dev --workspace backend
```

In another terminal, import the documented development accounts into W8LAB_BROWSER_* variables using the runtime account-import block in `BROWSER_VERIFICATION_2026-10-16.md`, then:

```powershell
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\report-access-20261016\full'
node e2e/laboratory-browser.cjs
```

For a new run, choose a new empty isolated directory for both DATA_DIR and W8LAB_BROWSER_RUN_DIR. No credentials, Authorization headers or token-bearing responses are included in the new evidence.

## Remaining scope

The five intentionally unfixed browser defects remain: rapid instrument-create duplicates, poor dark-theme contrast, missing persistent instrument-field labels, reviewer creation navigation and Reports navigation 404. The absent business application form remains BLOCKED. No pending policy question affects this fix.

Changes remain local on `main`; no commit, push, PR, merge or deployment was performed.
