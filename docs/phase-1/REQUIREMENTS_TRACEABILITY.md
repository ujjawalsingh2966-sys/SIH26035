# Requirements Traceability Matrix (Phase 1 Baseline)

| Requirement ID | Description | Source Traceability | Architectural Component |
| :--- | :--- | :--- | :--- |
| **FR-INST-01** | Strict NAWI restriction | LM Model Approval Rules, 2011 | Instrument Schema Controller |
| **FR-INST-02** | Class, Max, Min, `e`, `d` parameters | OIML R 76-1:2006 (Clause 3.1) | Instrument Data Model | 
| **FR-OBS-01** | Test grids aligned to Annex A | OIML R 76-1:2006 (Annex A) | Frontend PWA / React Views |
| **FR-CALC-01** | $E = I + 0.5e - \Delta L - L$ calculation | OIML R 76-1:2006 (Clause A.4.4.3) | Math Engine (Backend Core) |
| **FR-RULE-01** | MPE dynamic limit evaluation | OIML R 76-1:2006 (Table 6) | Dedicated Rules Evaluator |
| **FR-RULE-04** | Rule calculation explainability | Phase 1 SRS extraction (Audit requirement) | Compliance Trace Engine |
| **FR-WF-01** | `DRAFT` $\rightarrow$ `APPROVED` lifecycle | Standard QMS procedures | State Machine & Workflow Guard |
| **FR-SEC-01** | Static internal rule version binding | Evidentiary legal compliance | Data Persistence Layer |
| **FR-SEC-02** | Cryptographic SHA-256 state seal | Phase 0/0B Digital Signature adjustment | Cryptography Utilities |
| **FR-REP-02** | OIML R 76-2:2007 reporting | Phase 0 Regulatory Decisions | PDF Generator Service |
| **NFR-02** | Arbitrary precision accuracy | Phase 0/0B Mathematial constraints | Data Types (e.g. `decimal.js`) |
