# Technical and Protocol Decisions

## 1. Mathematical Accuracy over Performance
**Decision:** Adopt arbitrary-precision arithmetic engines (e.g. `BigDecimal`) system-wide.
**Reason:** The fundamental necessity of the system is absolute mathematical integrity. OIML standards (especially zeroing limits tracking values around 0.5e and fractions of decimal weights) will be aggressively degraded by standard native float representations (e.g. `1.00000000004`). Floating points are strictly excluded from calculation pipelines.

## 2. Dynamic Evaluative Rule Engine Let by Strict Versioning
**Decision:** All calculations process through an abstract rule handler, but tests are inextricably linked to a singular Rule Version by ID on creation.
**Reason:** Legal reproducibility (NFR-REP-01). If the law changes in 2026, recreating a PDF from a 2024 test must evaluate and render the exact 2024 compliance pass/fail response.

## 3. Exclusion of Automatic/IoT Integrations (MVP)
**Decision:** Direct serial or IoT polling of electronic indicators is deliberately excluded from the current phase roadmap.
**Reason:** Expanding software boundary to hardware peripherals introduces unknown risk surfaces and testing delays not relevant to the pure algorithmic and regulatory validation scope defined for MVP. 

## 4. Exclusion of Automatic Weighing Instruments (AWI)
**Decision:** Instruments flagged as AWI will halt the processing pipeline instantly and declare "Out of Scope".
**Reason:** NAWIs (OIML R 76) evaluate purely based on static mass applied by human operators. AWIs dynamically weigh items continuously requiring integration of physics variables (OIML R 51 / OIML R 134) entirely unmodeled in standard R 76 processes.

## 5. Event Sourcing for Test Revisions
**Decision:** Use explicit state machines and append-only audits to track test lifecycle.
**Reason:** Cryptographic seals demand a verifiable history. A "Returned for Correction" step cannot secretly overwrite data without leaving an auditable footprint of what the original observation constituted.

## 6. Offline Data Write-Through Limits
**Decision:** The technician UI will provide offline observation caching but explicitly block state transitions (e.g., transition to `SUBMIT`).
**Reason:** State transitions invoke compliance validations that must act upon the centralized immutable rule engine state to enforce security constraints avoiding bypass tactics on local devices.

## 7. Open Questions and Clarifications Needed (Ambiguities)
The subsequent modules necessitate stakeholder feedback or specific documentation clarifications prior to Phase 8 implementations:
1. **Report Standardization:** Are there precise structural definitions mandated by Indian Legal Metrology for digital certificates? (If NO, standard OIML R76 generic matrix reporting will be implemented.)
2. **Rounding Prerogatives:** Does local jurisdiction strictly follow OIML interval truncation for derivation values, or do they apply custom rounding behavior at intermediary turning points?
3. **Digital Signatures vs Hashing:** Does local statutory law require Indian IT Act (Sec 3) compatible remote signing (via Aadhaar/DSC Class 3 tokens), or will a raw internal cryptographic SHA-256 seal pass regulatory sandbox tests for the MVP?
4. **Instrument Extensiveness:** Should mechanical non-electronic NAWIs be anticipated in UI constraints, or is digitization structurally intended for electronic scales? 
