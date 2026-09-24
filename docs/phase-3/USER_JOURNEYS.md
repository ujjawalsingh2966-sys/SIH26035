# User Journeys

## Inferred Personas

*   **Laboratory Technician**: primary actor running physical tests. Goal: Ensure pristine observation capture matching laboratory realities.
*   **Approving Officer (Reviewer)**: secondary actor managing compliance. Goal: Validate computations and statutory safety prior to sealing certificates.

## 1. Technician Success Journey
**Goal:** Run a compliance check on a new NAWI instrument.
**Steps:**
1. Log in. View Dashboard. Click `New Test Workflow`.
2. Hardware metadata input (Max, Min, Class). System applies `INSTRUMENT_SCOPE_MATRIX` classification.
3. System routes to `Test Selection Matrix` confirming applicable required modules (e.g., `TEST-WEIGH`, `TEST-ECC`).
4. Enter observation metrics ($I$, $\Delta L$) inside specific test tables.
5. Hit `Validate`. Watch engine verify the formulas ($P, E_c$). Results pass `< MPE` limits.
6. Submit officially to the Approving Officer.
**Ending State:** Test transitions to `PENDING_REVIEW` queue.

## 2. Technician Blocked Journey (Unsupported Device)
**Goal:** Attempt to test a continuous motion AWI device.
**Steps:**
1. Start `New Test Workflow`.
2. Input hardware parameters: `Scale = Automatic`.
3. System hits Phase 2 `DEFERRED_DOMAIN_SCOPE.md` boundaries.
4. Hard stop UI fires `UX-013 Unsupported Instrument Block`.
**Ending State:** Data entry locked. Operation aborted legally.

## 3. Approver Success Journey
**Goal:** Verify and release a completed evaluation.
**Steps:**
1. Log in. Access `Pending Review` queue.
2. Open Technician's submitted test. View full contextual UI separating Raw Inputs vs Metrological Results.
3. Review audit trace verifying the Active Statutory Version (e.g. `OIML-R76-1-2006-CORE`).
4. Execute `Approve Workflow`.
5. Preview resulting PDF generation.
**Ending State:** Test moved to `APPROVED`. Certificates triggered.

## 4. Approver Correction Journey
**Goal:** Force rework on invalid raw inputs (e.g. impossible $E_0$ offsets).
**Steps:**
1. Open submitted test. Notice mathematical anomaly mapped via `DOMAIN_ERROR_CATALOG`.
2. Hit `Return for Correction`.
3. Fill mandatory "Correction Reason" text block.
**Ending State:** Sequence reverts to Technician's active dashboard flagged as `Rework required`.
