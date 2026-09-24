# Observation Entry UX

This represents the heaviest data-entry workspace in the application. Precision and clarity dictate every pixel.

## 1. Visual Separation of Concerns
The fundamental principle of all numerical UI tables in this application is the strict separation of User Reality vs. Engine Math.

**Visual Paradigm:**
* **Left Table Zone (RAW ENTRY):** Plain text boxes accepting `Number` variables. This space maps specifically to statutory realities. 
  * Header labels: Applied Load ($L$), Indication ($I$), Additional Weight ($\Delta L$).
* **Right Table Zone (CALCULATED):** Darkened or shaded read-only zones, rendering immediately upon completion of the left inputs.
  * Header labels: Analog True ($P$), Error ($E$), MPE Compliance ($E_c$). 

Users must physically trace how reality resulted in math boundaries without assuming magic numbers.

## 2. Table Input Behavior
* Tabbing proceeds directionally rightwards, then down, mirroring laboratory spreadsheet realities. 
* Base units are appended explicitly inside the placeholders (e.g. `[     ] mg`).
* Empty fields force `NaN` blocks internally, disabling the validation button until fully parsed arrays exist. 
* Floating-point limitations are purely superficial (visual formatting); the real payload passed natively uses string mapping for `decimal.js` handling as dictated by `ROUNDING_PRECISION_SPECIFICATION.md`.

## 3. Feedback Loop Warnings
Before fully Submitting or Reviewing, the `Observations` UI flashes yellow inline indicators outlining any bounds exceeding Phase 2's `INSTRUMENT_LIMITS_SPECIFICATION`.
* E.g. "Load $L$ exceeded $(Max + 9e)$" triggers a tooltip natively halting that row's calculations.

## 4. Zero-Error Persistence ($E_0$)
Since $E_0$ is evaluated universally against all corrected error operations, it represents a global variable persistently anchored at the top of the specific active Module workspace to remind operators of its persistent application.
