# Instrument creation contrast fix — 2026-10-16

Publication note: raw browser artifacts linked below are retained locally and excluded from Git. See the [published verification summary](verification/2026-10-16/SNAPSHOT_VERIFICATION.md) for selected redacted evidence and fresh snapshot checks. Account-import snippets now use the local demo environment loader instead of publishing passwords.

Implemented in the existing local SIH26035 checkout, preserving all prior uncommitted work. The production change is confined to colors and disabled opacity on the instrument creation screen. No backend code, permissions, form semantics, validation, layout, submission guard or saved-instrument retry logic changed.

## Browser diagnosis before editing

The existing isolated frontend/backend at `http://127.0.0.1:3010` and `http://127.0.0.1:4001` both responded. The browser signed in through the real login form and matched the backend's instrument IDs to `artifacts/browser-review/instrument-submit-20261016/full/data` before inspecting the form. This reproduction made no creation requests.

Actual theme mechanism: Tailwind has no `darkMode` override, so `dark:` utilities follow `prefers-color-scheme`. There is no theme toggle or theme-setting code in this checkout. Browser inspection found no root `dark` class or `data-theme` attribute. Shared CSS also defines theme variables (and attribute overrides), but the instrument component uses existing Slate palette utilities. In dark media, `--color-text`, `--color-bg` and `--color-surface` became `#f5f5f5`, `#0a0a0a` and `#171717` respectively. The dashboard's `.mesh-background` remained the same pale gradient, with base `rgb(250,245,255)`, in both themes.

Affected elements:

- `CREATE INSTRUMENT RECORD` on both steps.
- `Step 1: Statutory Classification Gate` and `Step 2: Core Metadata & Limits`.
- Step 2's `Equipped with Tare device?` checkbox text.

Their dark foreground was `rgb(241,245,249)`, but the form and surrounding containers were transparent. The pale mesh showed through, producing about **1.02:1 against its base color**. This before-fix ratio is an estimate because the actual gradient varies spatially; the screenshots show the rendered defect without selecting text. Step 1's four classification labels were already readable on their opaque `rgb(30,41,59)` panel (13.35:1), and were retained.

The same inspection found four light-theme measurement placeholders at **4.37:1** (`rgb(100,116,139)` on `rgb(239,246,255)`). Subsequent real-save state probes exposed disabled placeholder combinations at 4.34:1 in light and 3.75:1 in dark, and Chromium's disabled select opacity of 0.7. These were corrected locally as part of the requested state checks. Existing entered values, normal select options and button/error text did not need new palettes.

Before evidence: [computed styles and theme variables](../artifacts/browser-review/instrument-contrast-20261016/reproduction/before-2026-10-16T15-58-50-218Z/results.json), [dark step 1](../artifacts/browser-review/instrument-contrast-20261016/reproduction/before-2026-10-16T15-58-50-218Z/dark-step1-unchecked-focus.png), [dark step 2](../artifacts/browser-review/instrument-contrast-20261016/reproduction/before-2026-10-16T15-58-50-218Z/dark-step2-populated.png). The historical D3 reproduction is retained in `docs/BROWSER_VERIFICATION_2026-10-16.md`.

## Changed files

- `frontend/app/(dashboard)/instruments/new/page.tsx`: pairs the existing foreground colors with an opaque white / Slate 900 form surface; dark text can no longer land directly on the mesh. Uses Slate 600 for light measurement placeholders and disabled placeholders, Slate 400 for dark disabled placeholders, and explicit disabled opacity 1 for the existing inputs/select. No spacing, sizing, handler or field-label changes.
- `e2e/contrast.cjs`: reusable computed-color measurement through transparent/alpha backgrounds. It records foreground, background layers, contrast, gradients, opacity and focus styles. Gradient base estimates are explicitly marked approximate.
- `e2e/instrument-contrast.cjs`: focused real Chromium checks for both steps/themes, empty/populated fields, live OS theme changes, checked/unchecked checkboxes, keyboard focus, options, real validation errors and pending/disabled states. Its `--inspect` mode captures diagnostic evidence without reporting passing assertions or creating records.
- `e2e/laboratory-browser.cjs`: strengthens the existing contrast scenario to measure both steps' actual painted backgrounds, both headings and every checkbox label. Retains the heading minimum of 3:1, adds the 4.5:1 label minimum and rejects approximate gradient measurements. The old measurement assumed the distant mesh was always behind the heading; the new helper follows the rendered background layers. Other scenarios/assertions are unchanged.
- `.gitignore` and `frontend/tsconfig.browser.json`: one isolated `.next-contrast-review` cache exclusion/type include, allowing existing services and their build caches to remain intact. The type include was generated by Next's supported alternate build directory setup.
- This handoff document.

Shared `globals.css`, dashboard layout and Tailwind theme configuration were inspected and left untouched. No global overrides, universal selectors or `!important` rules were added.

## Focused browser verification

Playwright **1.64.1**, actual Chromium **156.0.8078.4**, headless full browser. After reproduction, separate services on **http://127.0.0.1:3011** and **http://127.0.0.1:4002** used fresh `artifacts/browser-review/instrument-contrast-20261016/focused/data` storage. The earlier services and records were preserved. All successful saves used the real backend. Requests were restricted to the two local origins; original project JSON hashes/inventory were unchanged. Account values/login inputs were masked in screenshots and credentials were supplied at runtime.

Authoritative focused run: [results with all 344 measurements](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/results.json), [network evidence](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/network.json), [console](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/console.json). **4 groups PASS, exit 0**, no page errors. All final measurements used opaque known backgrounds; minimum measured text contrast was 4.76:1.

| Scenario group | Result |
| --- | --- |
| Light: both steps, empty/populated fields, checkbox and focus states | PASS |
| Dark: both steps, empty/populated fields, checkbox and focus states | PASS |
| Live light/dark/light OS scheme changes retain entered values and readable colors | PASS |
| Real validation rejection, readable loading/disabled controls and rapid successful retry | PASS |

Relevant final colors:

| Element/state | Foreground | Painted background | Contrast |
| --- | --- | --- | ---: |
| Light headings | `rgb(15,23,42)` | `rgb(255,255,255)` | 17.85:1 |
| Dark headings / Tare label | `rgb(241,245,249)` | `rgb(15,23,42)` | 16.30:1 |
| Dark classification labels / entered input values | `rgb(241,245,249)` | `rgb(30,41,59)` | 13.35:1 |
| Light measurement placeholders | `rgb(71,85,105)` | `rgb(239,246,255)` | 6.96:1 |
| Normal dark placeholders | `rgb(148,163,184)` | `rgb(30,41,59)` | 5.71:1 |
| Disabled light values/placeholders/select | `rgb(71,85,105)` | `rgb(241,245,249)` | 6.92:1 |
| Disabled dark values/placeholders/select | `rgb(148,163,184)` | `rgb(15,23,42)` | 6.96:1 |
| Dark validation error | `rgb(254,202,202)` | composite `rgb(42,17,26)` | 12.19:1 |

After screenshots: [dark step 1 and keyboard focus](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/dark-step1-unchecked-focus.png), [dark step 2 populated](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/dark-step2-populated.png), [light step 2 empty](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/light-step2-empty.png), [light validation error](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/light-validation-error.png), [dark validation error](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/dark-validation-error.png), [light pending/disabled](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/light-pending-disabled.png), [dark pending/disabled](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/dark-pending-disabled.png). The same directory contains both themes' empty/populated/focused screenshots for comparison.

Explicit negative injection replaced the outgoing instrument name with an empty string, yielding the backend's real HTTP 400 while preserving the form's values. Retry used the original valid values. Its real HTTP 201 was held until both themes' pending states were checked, then forwarded unchanged. Two rapid clicks plus native form submission during retry still produced only one successful instrument save and one case save: [actual request and persisted IDs](../artifacts/browser-review/instrument-contrast-20261016/focused/contrast-2026-10-16T16-04-30-638Z/persisted-counts.json). There were two instrument POSTs total (one rejected 400, one successful 201), one case POST and one persisted record of each type.

The existing submission runner was also rerun unchanged: **9 PASS, exit 0**. [Results](../artifacts/browser-review/instrument-contrast-20261016/focused/submission-2026-10-16T16-05-08-521Z/results.json) cover rapid clicks, Enter plus clicks, slow real responses, rejection/retry, saved-instrument reuse after downstream rejection, subsequent legitimate instruments, ambiguous response handling and classification validation.

Earlier focused attempts are retained. Test-harness corrections used real Tab navigation for `:focus-visible`, scoped validation alerts to exclude Next's announcement region and waited for held-response delivery before unregistering its route. An early route-cleanup error (`Route is already handled!`) produced two synthetic instrument writes in that attempt; those isolated records were retained. Other early attempts exposed the disabled-state contrast issues above. They are not the authoritative completed results. No existing records were removed.

## Commands and service setup

From the existing repository root, separate terminals:

```powershell
$env:PORT='4002'
$env:CLIENT_URL='http://127.0.0.1:3011'
# focused\data for focused checks; full\data for the full runner.
$env:DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-contrast-20261016\full\data'
npm.cmd run dev --workspace backend
```

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_BUILD_DIR='.next-contrast-review'
npm.cmd run dev --workspace frontend -- --hostname 127.0.0.1 --port 3011
```

Only this task's services were stopped/restarted when switching isolated datasets and building. A fresh directory was used for the full runner's empty-state expectation; do not clear existing test data to repeat it. Use another fresh run directory instead. The supported backend setup initializes its storage; login uses the documented development account setup.

Runtime account import and verification commands:

```powershell
. .\e2e\local-staff-env.ps1

# Before editing: read-only diagnosis against the already verified old services.
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-contrast-20261016\reproduction'
$env:W8LAB_BROWSER_DATA_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-submit-20261016\full\data'
node e2e/instrument-contrast.cjs --inspect

# After editing, using this task's focused services/storage.
$env:W8LAB_BROWSER_DATA_DIR=$null
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3011'
$env:W8LAB_BROWSER_BACKEND='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-contrast-20261016\focused'
node e2e/instrument-contrast.cjs
node e2e/instrument-submission.cjs

# After restarting only this task's backend with fresh full\data.
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts\browser-review\instrument-contrast-20261016\full'
node e2e/laboratory-browser.cjs
```

Frontend checks:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json
# Stop only this task's frontend before building its cache; restart afterward.
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4002'
$env:W8LAB_BROWSER_BUILD_DIR='.next-contrast-review'
npm.cmd run build --workspace frontend
node --check e2e/contrast.cjs
node --check e2e/instrument-contrast.cjs
node --check e2e/laboratory-browser.cjs
git diff --check
```

Typecheck, production build and syntax checks passed (exit 0). Production build compiled and generated all nine pages. Next's existing informational warning about the inherited TypeScript plugin remained non-blocking. No backend tests/build were required for this CSS-only product change; the actual backend was exercised by the browser suites.

## Full browser result and remaining work

The full runner was executed **once after the final fix**: **33 PASS / 3 FAIL / 1 BLOCKED**, exit 1 because the three previously known defects remain. The prior result was 32 / 4 / 1; contrast is the single resolved full-run scenario. No other assertion was removed or weakened.

Full evidence: [scenario results](../artifacts/browser-review/instrument-contrast-20261016/full/attempt-2026-10-16T16-06-45-348Z/results.json), [network](../artifacts/browser-review/instrument-contrast-20261016/full/attempt-2026-10-16T16-06-45-348Z/network.json), [console](../artifacts/browser-review/instrument-contrast-20261016/full/attempt-2026-10-16T16-06-45-348Z/console.json), [both steps' measured dark colors](../artifacts/browser-review/instrument-contrast-20261016/full/attempt-2026-10-16T16-06-45-348Z/dark-heading-colors.json), [dark metadata screenshot](../artifacts/browser-review/instrument-contrast-20261016/full/attempt-2026-10-16T16-06-45-348Z/dark-heading-and-checkbox-contrast.png), [dark classification screenshot](../artifacts/browser-review/instrument-contrast-20261016/full/attempt-2026-10-16T16-06-45-348Z/dark-classification-contrast.png).

| Relevant full-run scenario | Result |
| --- | --- |
| Dark headings and checkbox labels on both steps | PASS |
| Input values/placeholders in both themes | PASS |
| Repeated creation requests and persisted counts | PASS |
| Review, correction, resubmission, approval and retained history | PASS |
| Approved report access restrictions / browser PDF download | PASS |
| Metadata fields retain persistent names after entry | FAIL — intentionally unchanged |
| Reviewer creation navigation | FAIL — intentionally unchanged |
| Reports navigation | FAIL — existing 404 |
| Business application form | BLOCKED — absent route, not implemented |

There were no browser page errors. Network/console HTTP errors correspond to deliberate validation/access/stale-state/offline probes and the existing Reports 404. All traffic stayed local and original project data remained unchanged. Both this task's services were left running on 3011/4002 with the full isolated dataset. Existing services on 3010/4001 were preserved. Changes remain local; no commit, push, PR, merge or deployment was performed.
