# Persistent instrument labels — 2026-10-16

Publication note: raw browser artifacts linked below are retained locally and excluded from Git. See the [published verification summary](verification/2026-10-16/SNAPSHOT_VERIFICATION.md) for selected redacted evidence and fresh snapshot checks. Account-import snippets now use the local demo environment loader instead of publishing passwords.

Fixed in the existing local SIH26035 checkout on `main`, preserving previous uncommitted work. No applicable AGENTS.md was found in the repository or its ancestor chain. No branch change, pull, reset, stash, commit, push, PR, merge or deployment was performed.

## Reproduced cause and fields corrected

The seven metadata text inputs used only placeholders, which disappear after typing. They had empty IDs and zero associated labels. The Accuracy Class select also had no visible or associated label; its selected option was the only clue to its purpose. Step 1's four classification checkboxes and Step 2's Tare checkbox already had valid wrapping labels, which were preserved.

Before changing the component, real Chromium signed in to the existing isolated services on `http://127.0.0.1:3011` and `http://127.0.0.1:4002`. It matched served instrument IDs to the previous contrast run's `full/data` storage and inspected both steps at 1440px and 390px in light/dark media. This diagnostic run made no creation requests. [Before snapshots](../artifacts/browser-review/instrument-labels-20261016/reproduction/before-2026-10-16T16-19-00-262Z/results.json) record all eight missing associations; [populated before screenshot](../artifacts/browser-review/instrument-labels-20261016/reproduction/before-2026-10-16T16-19-00-262Z/1440-light-populated-top.png) shows the disappearing field names. The historical D2 report and its original screenshot remain unchanged.

| Persistent visible label / accessible name | Unique control ID |
| --- | --- |
| Name | `instrument-name` |
| Model | `instrument-model` |
| Serial Number | `instrument-serial-number` |
| Accuracy Class | `instrument-accuracy-class` |
| Max Capacity | `instrument-max-capacity` |
| Min Capacity | `instrument-min-capacity` |
| Verification Scale Interval (e) | `instrument-e` |
| Actual Scale Interval (d) | `instrument-d` |

Every new label uses matching `htmlFor` / `id`. Existing placeholder wording, example/hint text, values, options and accepted units were retained. No required attributes, indicators, unit requirements or validation rules were invented. Existing general validation alerts remain unchanged; the form did not have per-field validation/help associations to replace.

## Changed files

- `frontend/app/(dashboard)/instruments/new/page.tsx`: adds eight visible associated labels using the existing `.input-label` convention. Keeps the corrected opaque light/dark surfaces and input styles. Field wrappers use a two-column desktop grid and one column below `sm`; full-width controls and `min-w-0` prevent clipping. Only label accommodation/layout changed. State, payloads, validation, synchronous in-flight guard, saved-instrument checkpoint and retry logic were not edited.
- `e2e/instrument-labels.cjs`: new focused local real-browser regression runner, with a read-only `--inspect` mode for before evidence. Checks visible text, exact accessible names, unique IDs, association, label clicks, focus, keyboard order, checkbox/select activation, geometry/no horizontal overflow, label contrast and failure/loading/retry states.
- `e2e/laboratory-browser.cjs`: preserves the original missing-label assertion verbatim. Adds visible `label[for]`, matching unique control association and accessible-name checks for text fields and the select. An aria-label alone cannot satisfy the new checks. Other scenarios remain unchanged.
- This report. No shared styles, theme configuration, backend files or browser cache configuration were changed for this task.

## Browser results and screenshots

Actual tooling: Playwright **1.64.1**, full headless Chromium **156.0.8078.4**. Supported OS/browser light and dark color schemes were exercised through `emulateMedia`, matching the application's existing media-based theme mechanism.

Authoritative focused run: [results and state snapshots](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/results.json), [real network requests/statuses](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/network.json). **6 PASS, exit 0**, zero browser page errors.

| Focused scenario | Result |
| --- | --- |
| 1440px light, both steps, empty/populated fields, label-click focus and existing checkbox labels | PASS |
| 1440px dark, same coverage | PASS |
| 390px light, same coverage with no horizontal overflow | PASS |
| 390px dark, same coverage with no horizontal overflow | PASS |
| Keyboard Tab order, native select change, Space activation and retained values/labels | PASS |
| Real 400 rejection, saved-instrument 404, disabled/loading labels and successful retry | PASS |

New labels were checked while empty, populated, focused, disabled and displaying errors. All eight exact accessible names and label associations passed. Clicking each label focused the corresponding control. Keyboard traversal included the select and existing Tare checkbox. Labels met the 4.5:1 contrast check on known painted backgrounds in both themes.

Populated screenshots:

- [Desktop light](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/1440-light-populated-top.png), [desktop dark](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/1440-dark-populated-top.png).
- [390px light top](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/390-light-populated-top.png), [390px light bottom](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/390-light-populated-bottom.png).
- [390px dark top](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/390-dark-populated-top.png), [390px dark bottom](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/390-dark-populated-bottom.png).
- [Validation state](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/light-validation-labels.png), [saved instrument/disabled metadata](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/saved-instrument-disabled-labels.png), [dark pending state](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/dark-pending-disabled-labels.png).

Each narrow screenshot captures one part of the scrollable form; top/bottom together show all eight fields. Step-1 checkbox screenshots for both themes/viewports are in the same directory. Login inputs/account identifiers were masked.

Failure injection was explicit: the first outgoing instrument request's name was replaced with an empty string, producing the backend's real 400. The subsequent real successful instrument save was followed by an outgoing case request with a missing synthetic instrument ID, producing a real 404. Retrying reused the saved instrument; its real case 201 response was held while labels were checked in both loading themes, then forwarded unchanged. No successful response was fabricated.

[Persisted/request counts](../artifacts/browser-review/instrument-labels-20261016/focused/labels-2026-10-16T16-20-27-068Z/persisted-counts.json): two instrument POSTs (one rejected), two case POSTs (one rejected), **one saved instrument and one saved case**. Rapid clicks plus native form submission during the retry produced no additional save. The existing submission runner was also run unchanged: **9 PASS, exit 0**; [results](../artifacts/browser-review/instrument-labels-20261016/focused/submission-2026-10-16T16-21-09-629Z/results.json) cover overlap guards, keyboard submission, delayed real responses, confirmed failure/retry, saved-instrument reuse, new legitimate instruments, uncertain outcomes and classification validation.

**Autofill limitation:** actual browser autofill was not verified. The installed Chromium CDP tooling offers address/card autofill, rather than generic instrument metadata, and the isolated browser has no saved instrument profile. Instrument fields were not relabeled as personal/address/payment fields to force that mechanism. Typed or programmatically filled values are not claimed as actual autofill. Firefox, WebKit and physical assistive-technology testing were not performed.

## Local services and commands

After the before reproduction, only the previous isolated 3011/4002 services were restarted with fresh task-specific storage. Existing records, previous verification artifacts and the other local services were preserved. Frontend targets the local backend explicitly. Supported backend `DATA_DIR` initialization/development login setup was used, with credentials imported from the existing local account guide into environment variables; no credentials were added to source or reports.

Backend (use `focused\data` for focused runners, fresh `full\data` for the full runner):

```powershell
$env:PORT='4002'
$env:CLIENT_URL='http://127.0.0.1:3011'
$env:DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-labels-20261016\full\data'
npm.cmd run dev --workspace backend
```

Frontend in another terminal:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_BUILD_DIR='.next-contrast-review'
npm.cmd run dev --workspace frontend -- --hostname 127.0.0.1 --port 3011
```

With `W8LAB_BROWSER_TECHNICIAN` / `W8LAB_BROWSER_PASSWORD` imported from `docs/LABORATORY_REVIEW_WORKFLOW.md` (the full runner also uses its documented Reviewer, Administrator and Different technician environment variables):

```powershell
# Read-only before reproduction, using the already verified old dataset.
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-labels-20261016\reproduction'
$env:W8LAB_BROWSER_DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-contrast-20261016\full\data'
node e2e/instrument-labels.cjs --inspect

# With the backend running against the focused dataset.
$env:W8LAB_BROWSER_DATA_DIR=$null
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3011'
$env:W8LAB_BROWSER_BACKEND='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-labels-20261016\focused'
node e2e/instrument-labels.cjs
node e2e/instrument-submission.cjs

# After restarting only this isolated backend with fresh full\data.
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-labels-20261016\full'
node e2e/laboratory-browser.cjs
```

Frontend checks actually run:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
# Stop only the isolated frontend before building its existing separate cache.
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_BUILD_DIR='.next-contrast-review'
npm.cmd run build --workspace frontend
node --check e2e/instrument-labels.cjs
node --check e2e/laboratory-browser.cjs
git diff --check
```

Typecheck, frontend production build and syntax checks passed (exit 0). Build compiled, checked types and generated all nine pages. The existing informational inherited-TypeScript-plugin warning was non-blocking. No backend source changed; backend tests/build were not rerun. Successful saves and rejection responses above came from the real backend.

## Full result and remaining defects

The full existing browser runner ran **once after the fix**: **34 PASS / 2 FAIL / 1 BLOCKED**, exit 1 because the two known out-of-scope defects remain. Previous result: 33 / 3 / 1. Persistent labels are the single newly passing full-run scenario. The original failure assertion was retained, with stronger visible-label checks added.

Full evidence: [results](../artifacts/browser-review/instrument-labels-20261016/full/attempt-2026-10-16T16-22-40-532Z/results.json), [network](../artifacts/browser-review/instrument-labels-20261016/full/attempt-2026-10-16T16-22-40-532Z/network.json), [console](../artifacts/browser-review/instrument-labels-20261016/full/attempt-2026-10-16T16-22-40-532Z/console.json), [populated light form](../artifacts/browser-review/instrument-labels-20261016/full/attempt-2026-10-16T16-22-40-532Z/instrument-light.png), [populated dark form](../artifacts/browser-review/instrument-labels-20261016/full/attempt-2026-10-16T16-22-40-532Z/instrument-dark.png).

| Relevant full-run scenario | Result |
| --- | --- |
| Persistent metadata labels and control associations | PASS |
| Both-theme field readability and dark headings/checkbox contrast | PASS |
| Rapid creation request/persisted-record counts | PASS |
| Laboratory correction, resubmission, approval and retained audit history | PASS |
| Report ownership restrictions and browser PDF download | PASS |
| Reviewer creation navigation | FAIL — existing prohibited action remains visible |
| Reports navigation | FAIL — existing `/reports` 404 |
| Business application form | BLOCKED — route absent, not implemented |

No browser page errors occurred; expected validation/access/stale-state/offline probes and the existing Reports 404 remain in network evidence. Original project JSON hashes/inventory were unchanged and browser application traffic stayed local. Test records and prior artifacts were retained. The isolated frontend/backend are left running on 3011/4002 with this task's `full/data` storage. To repeat a full run's empty-state check, choose a new fresh isolated run directory rather than deleting existing records.
