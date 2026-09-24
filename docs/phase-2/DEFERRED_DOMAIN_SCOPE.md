# Deferred Domain Scope

This document explicitly calls out statutory features, mathematical complexities, and secondary instruments explicitly evaluated during Phase 0–2 analysis but purposefully deferred from the current Engine MVP scope. 

Deferring these features prevents technical debt and ensures mathematical purity over the core Single-Range NAWI foundation.

## 1. Multiple Range and Multi-Interval Instruments
**Statutory Source:** OIML R 76-1:2006 (Clause 3.2, 3.3)
**Complexity Reason:** Modifying the base interval $e$ and resolution dynamically across changing capacities within the same physical platform breaks the base linear MPE array. 
**Deferral Plan:** Scheduled for Phase 4 (Post-V1.0). Requires structural alterations to the calculation matrix allowing dynamic swapping of verification intervals ($e_1, e_2, e_3$) mid-test.

## 2. Automatic Weighing Instruments (AWI)
**Statutory Source:** OIML R 51 (Catchweighers) & OIML R 134 (Dynamic Road Vehicles)
**Complexity Reason:** AWIs shift focus from static resting indications to dynamic motion arrays, chronometric pulse tracking, and continuous statistical variability, falling completely outside the R76-1 ruleset.
**Deferral Plan:** Requires entirely separate statutory engine modules independent of the NAWI core.

## 3. Class I / Ultra-High Precision Bounds
**Statutory Source:** OIML R 76-1:2006 Table 3 & Table 6.
**Complexity Reason:** Accuracy Class I requires environmental modeling (temperature gradients, barometric pressure, electrostatic calibration) absent from standard static payload evaluations. Testing bounds often demand 0.001 mg precision.
**Deferral Plan:** Deferred until Arbitrary Decimal stability on Class II is confirmed entirely bug-free in production scaling.

## 4. Hardware Serialization and Direct IoT Polling
**Statutory Source:** Technical Metrology Guidances / NSWS Integrations.
**Complexity Reason:** Core rule engine functions strictly as a pure stateless evaluation matrix. Managing Bluetooth/Serial COM ports directly violates the pure-math architectural separation.
**Deferral Plan:** External physical integration layers will wrap the API. The Core Engine itself will forever remain mathematically isolated and stateless.

## 5. Dynamic Time-Dependent Testing (Creep / Tilt)
**Statutory Source:** OIML R 76-1:2006 (Clause 3.9)
**Complexity Reason:** Time-dependent creep tests evaluating mechanical deformation across 4-hour spans demand complex state storage and session persistence logic within the stateless engine.
**Deferral Plan:** The GUI/Client application logic will shoulder state maintenance, formatting timed tests into delta evaluations injected as standard synchronous `TEST-WEIGH` subsets. 

## 6. Auxiliary Indicating Devices
**Statutory Source:** OIML R 76-1:2006 (Clause 3.4.1)
**Complexity Reason:** Devices differentiating Scale Interval ($d$) from Verification Interval ($e$) heavily (i.e. $d < e$) require complex rounding logic distinct from standard absolute digit processing.
**Deferral Plan:** Restricted to MVP blocking logic; future versions will integrate secondary verification interval derivations.
