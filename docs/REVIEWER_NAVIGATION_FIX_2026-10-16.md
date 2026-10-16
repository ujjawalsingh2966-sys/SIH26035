# Reviewer instrument-creation navigation — 2026-10-16

Publication note: raw browser artifacts linked below are retained locally and excluded from Git. See the [published verification summary](verification/2026-10-16/SNAPSHOT_VERIFICATION.md) for selected redacted evidence and fresh snapshot checks. Account-import snippets now use the local demo environment loader instead of publishing passwords.

Implemented in the existing local SIH26035 checkout on `main`. Existing uncommitted source, browser infrastructure, test records and artifacts were preserved. No applicable AGENTS.md was found in the repository or ancestor chain. Nothing was cloned, pulled, reset, stashed, committed, pushed, merged or deployed.

## Reproduction, root cause and policy

Actual reviewer login against the existing isolated frontend `http://127.0.0.1:3011` / backend `http://127.0.0.1:4002` reproduced:

- Dashboard header **New Instrument** linking to `/instruments/new`, on desktop and at 390px.
- Instrument Registry header **Register Instrument**, also visible at both widths.
- Direct `/instruments/new` navigation displaying a usable classification form.
- Real reviewer `POST /api/v1/instruments` returning **403 Forbidden: Insufficient permissions**, with persisted instrument IDs unchanged.

Code inspection additionally found two conditional **Register Instrument** dashboard empty-state links (one went through the registry), and the registry's existing inert **Import** button. The Evaluation Queue already restricted its **Start New Test** action to Technician. Sidebar links only open permitted sections; there was no sidebar creation action or separate mobile creation menu.

The dashboard/registry links and creation component did not consult the authenticated session. The dashboard layout held a valid session locally, but did not share it with these controls. Backend enforcement was already correct: authentication in `backend/src/app.ts`, followed by `requireRole(['Technician'])` on `instrumentRoutes.post('/')`, before validation/persistence. No backend gap was found or changed.

Policy matches `docs/phase-3/ROLE_BASED_UI_MATRIX.md`: Technician can create; Reviewer is read-only for creation/specs. Phase-9 RBAC similarly reserves creation for Technician, while Reviewer/Administrator perform reviews. Administrator's conceptual/global-default privileges do not grant this exact instrument-creation endpoint. **No unresolved policy conflict for this task.** The previously agreed Reviewer + Administrator approval workflow is unchanged.

Before evidence: [actual snapshots and 403 body](../artifacts/browser-review/instrument-navigation-20261016/reproduction/before-2026-10-16T16-35-16-609Z/results.json), [network](../artifacts/browser-review/instrument-navigation-20261016/reproduction/before-2026-10-16T16-35-16-609Z/network.json), [reviewer dashboard](../artifacts/browser-review/instrument-navigation-20261016/reproduction/before-2026-10-16T16-35-16-609Z/reviewer-1440-dashboard.png), [reviewer registry](../artifacts/browser-review/instrument-navigation-20261016/reproduction/before-2026-10-16T16-35-16-609Z/reviewer-1440-instruments.png), [usable creation form before](../artifacts/browser-review/instrument-navigation-20261016/reproduction/before-2026-10-16T16-35-16-609Z/reviewer-390-instruments-new.png). Served instrument IDs matched the previous labels run's isolated `full/data` directory before any test request. The denied probe did not create records.

## Changes and affected files

- `frontend/lib/laboratory.ts`: one `canCreateInstrument(session)` UI helper matching the exact existing backend Technician-only policy. Null, loading and other roles fail closed; backend remains authoritative.
- New `frontend/lib/dashboardSession.tsx`: a small context shares the dashboard layout's existing authenticated session. It contains no role registry or general permissions framework.
- `frontend/app/(dashboard)/layout.tsx`: provides that session, refreshes it on route changes, browser focus/pageshow and cross-tab token storage changes, and clears it on logout before redirecting. Existing permitted navigation remains available.
- `frontend/app/(dashboard)/dashboard/page.tsx`: guards the header action and both empty-state creation links.
- `frontend/app/(dashboard)/instruments/page.tsx`: guards Register Instrument and the existing Import affordance. Import still has no handler/backend implementation; no import feature was added. Registry metadata/read actions and Export were preserved.
- `frontend/app/(dashboard)/tests/page.tsx`: its existing creation link uses the same helper and shared session; review filtering/workflow logic is unchanged.
- `frontend/app/(dashboard)/instruments/new/page.tsx`: unresolved authentication displays a loading status; Reviewer/Administrator receive an access message with permitted registry/queue links and no creation form. Authorized Technician mounts the existing form keyed by identity, preventing a different user's session from inheriting an old checkpoint. The handler also rechecks the current session/identity before mutation. Existing synchronous submission guard, saved-instrument retry logic, labels, theme styles, values, validation and payloads remain in the form.
- New `e2e/instrument-navigation.cjs`: real local-browser regression checks plus read-only pre-fix diagnostic mode.
- This handoff document.

`e2e/laboratory-browser.cjs` was **not changed in this task**. Its original failing permission assertion was retained. No backend source, approval policy, Reports route, business application route, global styles or build configuration changed.

Direct route behavior is a client-side access message inside the existing Next route (the HTML route can return HTTP 200). It does not expose inputs or submission controls. The actual protected creation API rejects unauthorized roles with HTTP 403. UI hiding is not presented as backend authorization.

## Focused browser results

Actual tooling: Playwright **1.64.1**, Chromium **156.0.8078.4**, full browser headless. Fresh supported `DATA_DIR` storage was used under `artifacts/browser-review/instrument-navigation-20261016/focused/data`. Original project JSON inventory/hashes remained unchanged. All application traffic was confined to local origins. Credentials came from the existing local account guide through environment variables; login inputs/account identifiers were masked in screenshots and tokens were excluded from evidence.

Final focused run: [results](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/results.json), [network](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/network.json). **6 PASS, exit 0**, zero page errors.

| Scenario | Result |
| --- | --- |
| Desktop reviewer dashboard/registry/queue contain no creation action; direct URL and reload show no form | PASS |
| 390px reviewer pages have the same restrictions and permitted registry/queue access | PASS |
| Real Reviewer and Administrator POSTs return 403 with no persisted write; both denied on creation route | PASS |
| Server-rendered startup and delayed hydration do not show a creation form/action | PASS |
| Technician creates one instrument/case; logout then Reviewer login/reload has no stale actions | PASS |
| Real second-tab Reviewer login closes the existing Technician form and hides actions in the first tab | PASS |

Mutation observers watched actual DOM updates for temporary Reviewer/Administrator creation controls; checks found none. The hydration probe held and then continued real Next.js requests, without fabricated application responses. Successful login, reads and creation used the real backend. The first completed focused run also checked initially empty dashboard/registry states: [empty reviewer dashboard](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-37-54-403Z/reviewer-1440-dashboard.png). The final run checked the now-populated isolated data. Prior records were retained between runs.

[Persisted creation proof](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/technician-creation-proof.json) contains one Technician instrument ID and one associated case ID, with actual response statuses: Reviewer 403, Administrator 403, Technician instrument 201 and case 201. Rapid repeated submit attempts during the authorized flow did not create extra records.

After screenshots: [desktop dashboard](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/reviewer-1440-dashboard.png), [desktop registry](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/reviewer-1440-instruments.png), [390px dashboard](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/reviewer-390-dashboard.png), [390px direct-route denial](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/reviewer-390-direct-denied.png), [pre-hydration loading](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/reviewer-before-hydration.png), [after Technician logout / Reviewer login](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/reviewer-after-technician-logout.png), [cross-tab form closed](../artifacts/browser-review/instrument-navigation-20261016/focused/navigation-2026-10-16T16-39-02-106Z/cross-tab-session-change-denied.png).

The existing submission regression runner was run unchanged: **9 PASS, exit 0**. [Results](../artifacts/browser-review/instrument-navigation-20261016/focused/submission-2026-10-16T16-39-47-103Z/results.json) cover rapid clicks, keyboard submission, delayed real responses, confirmed failures/retries, saved-instrument reuse, legitimate subsequent instruments, ambiguous outcomes and classification validation.

## Commands and isolation

The previous isolated 3011/4002 services were verified before reuse/restart. Only these task-owned services were restarted for fresh focused/full storage and building; other existing services, caches and all previous records/artifacts were preserved. Final local URLs are frontend **http://127.0.0.1:3011**, backend **http://127.0.0.1:4002**.

Backend command, using `focused\data` for focused checks and fresh `full\data` for the full runner:

```powershell
$env:PORT='4002'
$env:CLIENT_URL='http://127.0.0.1:3011'
$env:DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-navigation-20261016\full\data'
npm.cmd run dev --workspace backend
```

Frontend in another terminal:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_BUILD_DIR='.next-contrast-review'
npm.cmd run dev --workspace frontend -- --hostname 127.0.0.1 --port 3011
```

Import the documented Technician, Reviewer, Administrator and Different technician account variables/password from `docs/LABORATORY_REVIEW_WORKFLOW.md`, as in previous browser reports; credentials are not repeated here. Commands actually run:

```powershell
# Before editing, existing services and verified previous isolated data.
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-navigation-20261016\reproduction'
$env:W8LAB_BROWSER_DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-labels-20261016\full\data'
node e2e/instrument-navigation.cjs --inspect

# With this task's focused backend storage.
$env:W8LAB_BROWSER_DATA_DIR=$null
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3011'
$env:W8LAB_BROWSER_BACKEND='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-navigation-20261016\focused'
node e2e/instrument-navigation.cjs
node e2e/instrument-submission.cjs

# Restart only this isolated backend with fresh full\data, then:
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-navigation-20261016\full'
node e2e/laboratory-browser.cjs
```

Frontend checks/build:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
# Stop only the isolated frontend before building its separate cache.
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_BUILD_DIR='.next-contrast-review'
npm.cmd run build --workspace frontend
node --check e2e/instrument-navigation.cjs
git diff --check
```

Typecheck and production build passed (exit 0); the build compiled, checked types and generated all nine pages. The existing inherited-TypeScript-plugin informational warning remained non-blocking. No backend source changed, so conditional backend tests/build were not rerun. Real browser requests verified the unchanged backend authorization.

## Full browser result and remaining scope

The full runner was executed **once after the final fix**: **35 PASS / 1 FAIL / 1 BLOCKED**, exit 1 due to the known Reports failure. Previous result: 34 / 2 / 1. Reviewer navigation is the single newly passing full-run scenario; its original permission assertion was not changed.

Full evidence: [scenario results](../artifacts/browser-review/instrument-navigation-20261016/full/attempt-2026-10-16T16-42-01-883Z/results.json), [network](../artifacts/browser-review/instrument-navigation-20261016/full/attempt-2026-10-16T16-42-01-883Z/network.json), [console](../artifacts/browser-review/instrument-navigation-20261016/full/attempt-2026-10-16T16-42-01-883Z/console.json), [retained approved laboratory state](../artifacts/browser-review/instrument-navigation-20261016/full/attempt-2026-10-16T16-42-01-883Z/approved-technician-history.png).

| Relevant scenario | Result |
| --- | --- |
| Original reviewer creation-navigation restriction | PASS |
| Reviewer queue, instrument/conditions/evaluations/evidence access | PASS |
| Return for correction, owning Technician correction and resubmission | PASS |
| Reviewer review/approval, reload locks and retained audit history | PASS |
| Administrator review/approval | PASS |
| Persistent labels, both-theme readability and corrected contrast | PASS |
| Duplicate creation prevention and report ownership restrictions | PASS |
| Reports navigation | FAIL — existing `/reports` 404 |
| Business application form | BLOCKED — absent route |

No application page errors occurred. Expected validation/access/stale-state/offline probes and the Reports 404 remain in the network/console evidence. Original project JSON inventory/hashes were preserved, and all browser application traffic stayed local. The isolated frontend/backend were left running on 3011/4002 with this task's full dataset. Repeating an empty-state full run requires a new isolated directory, not deleting existing records.

Narrow checks covered the existing responsive pages/header and their creation affordances. The existing mobile menu icon has no menu implementation; no unrelated mobile menu, registry edit/delete/import feature, Reports screen or business application route was created. Client session hints are not a substitute for backend checks. No unresolved creation-policy question remains.
