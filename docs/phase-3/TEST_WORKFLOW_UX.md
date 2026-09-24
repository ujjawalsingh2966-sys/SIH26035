# Test Workflow UX

This specifies the core UX pipeline for configuring and executing applicable tests.

## 1. Classification & Intake Gate
The workflow starts strictly through an Intake Gate ensuring domains align.
Users must supply:
* `Is Electronic?` [Yes / No]
* `Is Manual Mode?` [Yes / No] 
* `Ranges` [Single / Multi]

**Behavior:** Unverified combinations (e.g. Multi-range) immediately bounce the user to the `UX-013 Blocked` state, explicitly referencing OIML NAWI phase boundaries.

## 2. Parameter Locking
Once Class, Max, Min, $e$ and $d$ are keyed via the `INSTRUMENT_LIMITS_SPECIFICATION`:
* Values visually lock contextually in a persistent screen header.
* Base unit strings lock uniformly against all subset entries (preventing mix-ups).

## 3. Test Matrix Presentation
The application will NEVER drop the user into an infinitely scrolling open form. Instead, it reads the `TEST_APPLICABILITY_MATRIX.md` and generates a dashboard of specific testing pods.

**Conceptual Matrix View:**
* **Weighing Performance Check:** `[Mandatory]` - `(Not Started)`
* **Eccentricity Evaluation:** `[Mandatory]` - `(Not Started)`
* **Tare Evaluation Check:** `[Conditional]` - `(Skipped)`

Technicians explicitly pick modules from the table and drop into specialized sub-workspaces. Tests are grouped logically.

## 4. Safety Guardrails & Navigation
* If a technician attempts entering a module without configuring required base limits, they are physically blocked via modal alerts.
* Tests auto-save constantly. Navigating away without explicit "Submissions" stores the context as `DRAFT`.
