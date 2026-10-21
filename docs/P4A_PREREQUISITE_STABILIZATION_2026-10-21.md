# P4A prerequisite stabilization checkpoint — 21 October 2026

**Status: code committed for review, verification pending. P4A is NOT complete.**

Branch: `fix/p4a-prerequisite-fail-fast-20261021` from the exact PR #5 snapshot `88ed922229d263388c3a15962899f19d4b6da9f6`.
This is not based on `main` and does not include PR #6's separate PostgreSQL migration work.

## Scope

- Add explicit P4A-only fail-fast checks around offline Administrator bootstrap, validated Administrator login/role, and real-UI staff provisioning. If a prerequisite fails, do not run dependent P0–P4A browser scenarios using nonexistent staff.
- Capture a partial results JSON and redacted service logs even when a prerequisite aborts. Close isolated browser/server processes and check original-project dataset hashes when a baseline was established.
- Add two synthetic regression tests for Windows `rename EPERM`: strict low-level write rollback/retry and unit-of-work fail-closed behavior when compensation cannot complete.
- Existing P4A formulas, immutable results, RBAC, normal staff storage, production settings, real user accounts and original data remain unchanged. No unsafe delete/overwrite-on-EPERM fallback is introduced.

## Required verification on the developer's Windows workstation

Before starting: preserve local dirty work and back up any data; do not change branches inside an occupied worktree. Fetch this branch in a **separate worktree**. Never copy real `.env`, staff data or JWT secrets into the worktree.

1. Run isolated backend regression: `node backend/tools/test-isolated.cjs tests/p4aWindowsPersistencePrerequisite.test.ts tests/jsonRepositories.test.ts tests/staffAuthentication.test.ts`.
2. Run full isolated backend suite: `node backend/tools/test-isolated.cjs`. Run the frontend tests and builds per the existing README.
3. Build isolated P4A frontend and backend using the documented `docs/P4A_METROLOGICAL_PERFORMANCE.md` instructions and a new never-reused `artifacts/browser-review/` run directory. Run the managed P1→P4A browser suite, with `W8LAB_BROWSER_P2=1`, `W8LAB_BROWSER_P3=1`, `W8LAB_BROWSER_P3_1=1`, `W8LAB_BROWSER_P4A=1`. Confirm that ordinary provisioning succeeds and P4A scenarios actually execute.
4. Inject a provisioning failure **only against isolated synthetic test storage**. Confirm the browser wrapper stops before dependent scenarios, writes `results.json` with `aborted: true`, reports nonzero exit status, preserves original data hashes, and closes only processes it owns.
5. Separately investigate the real intermittent Windows atomic replacement denial: collect path-independent process/handle information, ACL/relevant OS diagnostic evidence, and error code in a redacted local report. Do not assume antivirus or rename semantics without evidence.

## Release gates

- Exact preexisting P0–P3.1 browser baselines green, plus P4A real Chromium checks and calculation review.
- No old P3 record recalculation or weakening of fail-closed native final approval.
- Any unresolved JSON persistence issue remains an **explicit blocker**; do not claim P4A or R76 full conformity complete.
- PR #5 and PR #6 stay unmerged and separate unless independently reviewed. No import, cutover or production deployment is authorized by this checkpoint.

## Verification honesty

The GitHub changes were prepared remotely. They are **not proof** of a new local Windows run, Chromium pass, official OIML conformity, or production certification.
