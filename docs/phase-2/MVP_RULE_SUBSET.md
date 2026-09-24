# MVP Rule Subset Definition

To ensure initial engine stability and strict adherence to verifiable constraints, the Minimum Viable Product (MVP) of the NAWI Rule Engine will restrict its execution boundaries to a highly constrained subset. 

This phased isolation limits complexity for mathematical verification and guarantees that the foundational calculation pipeline is robust before layering advanced topologies.

## 1. MVP Allowed Instrument Topologies
The engine will strictly authorize calculations ONLY for instruments passing the following flag matrix:

* `isNAWI`: `true`
* `isElectronic`: `true`
* `isSingleRange`: `true`
* `isGraduated`: `true` 
* `ScaleType`: `Manual` (or Semi-Automatic)

## 2. MVP Allowed Target Classes
MVP restricts evaluation to standard commercial sectors and foundational precision modules:

* **Class II** (High Accuracy)
* **Class III** (Medium Accuracy)
* **Class IIII** (Ordinary Accuracy)

*(Class I Special accuracy and specific fractional load boundaries are deferred conceptually to subsequent updates, post precision-engine stabilization).*

## 3. MVP Executable Test Types
Only the foundational test variants dictating pure metrological compliance are shipped under MVP.

* `TEST-WEIGH` (Standard weighing performance error check).
* `TEST-ECC` (Eccentricity evaluation).
* `TEST-TARE` (Weighing test using active tare offsets).

*(Tests demanding external chronometric state storage across sessions like `TEST-REP` Repeatability or Time-creep are shifted to v1.1).*

## 4. Input Configuration Constraints
* Loads MUST be injected purely in the absolute defined base unit format. The MVP unit parsing pipeline assumes direct parity bounded directly back to `$e$` and `$d$`.
* The GUI layer interacting with the MVP rule engine assumes the duty of gathering $I$, $\Delta L$, and $E_0$. MVP will strictly reject inputs omitting these explicit floats. 

## 5. Summary of Strict Exclusions applied to MVP Domain
If any of the following apply during execution in MVP, the engine MUST natively reject the sequence and throw a `BLOCKED` violation state:
* Mechanical mechanisms.
* Multi-interval or Multiple Range models.
* Auxiliary indicating devices (riders, verniers).
* Fully Automatic Weighing Instruments (AWI, Checkweighers).
* Serial/IoT dynamic polling loops. (MVP is statically synchronous observation -> response).

## 6. MVP Rule Applicability Version
The MVP subset will natively default to rule version `OIML-R76-1-2006-CORE-V1.0.0-MVP`.
