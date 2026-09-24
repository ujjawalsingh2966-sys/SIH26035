# Automated NAWI Compliance & Reporting System (ANCRS)
## Project Context

This document encapsulates the business context, problem statement, users, and comprehensive requirements for the ANCRS project, explicitly targeting Non-Automatic Weighing Instruments (NAWIs).

### 1. System Vision & Problem Statement
ANCRS is a secure, web-based regulatory compliance platform designed to digitize the physical testing workflows of NAWIs (e.g., retail scales, weighbridges). Currently, manual test calculations are prone to errors and lack standardized compliance evaluation. The system solves this by:
* Eliminating manual test calculation errors via a deterministic exact-precision calculation engine.
* Generating standardized, historically reproducible, and legally acceptable PDF test reports tailored for Legal Metrology.
* Preventing historical data corruption by inextricably linking past records to rule engine versions at the time of calculation.
* Enforcing strict workflows moving from Draft to Approved.

### 2. Users and User Workflows

#### 2.1. System Roles
* **Laboratory Technician:** Operates the instrument, conducts physical tests, inputs raw observations, and uploads attachments. They submit test records for review but cannot approve them or modify underlying rules.
* **Reviewing Officer:** Validates technician data, checks compliance outputs, and either grants final approval to freeze data or returns the record to the technician for corrections. They export the final PDF.
* **System Administrator:** Modifies OIML/Legal metrology rule sets and manages user roles. Excluded from processing or approving tests.

#### 2.2. End-to-End Workflow
1. **Initiation:** Manufacturer Request -> Test Case Creation.
2. **Setup:** Enter Instrument metadata (Class, Max, Min, e, d) -> Setup Lab Conditions -> Select Tests.
3. **Execution (Technician):** Add observations for specific tests (e.g., Eccentricity, Repeatability, Weighing tests).
4. **Validation (System):** System validates inputs, computes derived errors, compares against configured Rule Version based on MPE limit, and marks PASS/FAIL dynamically.
5. **Review:** Technician submits to Reviewing Officer. Record is locked to Technician.
6. **Approval:** Reviewing Officer reviews and either Returns for Correction or Approves.
7. **Finalization:** Approved record is cryptographically sealed, and a standard PDF report is generated and archived.

### 3. Functional Requirements (FR)

#### Instrument & Test Case Management
* **FR-INST-01:** System requires defining Instrument Class (I, II, III, IIII) before any test initialization.
* **FR-INST-02:** System requires Max, Min, e, and d parameters prior to test generation.
* **FR-INST-03:** Enforce logical constraints matching the active Rule Version selected.

#### Observation Entry & Validation
* **FR-OBS-01:** Provide specialized grids mapped mapped to OIML R76 tests.
* **FR-OBS-02:** Validate mandatory numeric input against mathematical invalidation (e.g., character injection in number fields).

#### Calculation Engine
* **FR-CALC-01:** Calculate Indication Error accurately based strictly on OIML Annex procedures.
* **FR-CALC-02:** Ensure absolute precision by operating natively in exact decimals, avoiding floating-point rounding deterioration.

#### Rule Engine & Compliance Evaluation
* **FR-RULE-01:** Dynamically select applicable MPE limit dynamically based on active rules.
* **FR-RULE-02:** Deliver discrete compliance states (PASS/FAIL) for individual observation rows.
* **FR-RULE-03:** Aggregate row-level compliance for overall section outcomes.

#### Review, Approval & Audit
* **FR-REV-01:** Reviewing Officers can transition states (Approved vs Returned).
* **FR-REV-02:** Freeze all raw test and evaluation data immediately upon approval.

#### Report Generation
* **FR-REP-01:** Generate comprehensive unified PDF reports (Manufacturer, Inputs, Results).
* **FR-REP-02:** Print the specific Rule Version employed on the report.
* **FR-REP-03:** Provide unique traceable document identifiers for the PDFs.

#### Rule Versioning
* **FR-VER-01:** Ensure every created Test Case is irrevocably assigned a specific Rule Version ID.

### 4. Non-Functional Requirements (NFR)
* **NFR-SEC-01 (Security):** Strict separation of duties via RBAC and hashed password/credentials.
* **NFR-PERF-01 (Performance):** Compute compliance metrics for a test suite in <2 seconds.
* **NFR-DATA-01 (Data Integrity):** Floating-point values must use explicitly exact decimal data types (BigDecimal).
* **NFR-REP-01 (Reproducibility):** Recalculating a past test record must identically reproduce results based on the historic rule settings applied initially.
* **NFR-AUD-01 (Auditability):** Every action requires UTC-timestamped, user-attributed transition logging.

### 5. Identified Screens & Modules
1. **Instrument Master / Classification Screen:** Checks instrument traits (must be NAWI), captures baseline specs.
2. **Dashboard / Test Queue:** Lists Test Cases pending draft, review, or archival.
3. **Observation Entry Grid:** Real-time data entry UI specific to OIML tests (Eccentricity, Repeatability, etc.) returning live indication error flags.
4. **Compliance Review Interface:** Transparent audit page showing applied load, derivation limits (MPE), explicit rule trace ("Calculated Error 1.8g > MPE Limit 1.5g for Class III under RuleSet v1.2").
5. **Workflow & State Management Subsystem:** Hides/Shows actions (Approve, Return, Submit) based on current state and user RBAC.
6. **Rule Generation / versioning Engine (Admin):** Interface for defining threshold rules and activating constraints.
7. **Document Management:** Preview and fetch finalized PDF tests with digital watermarking.

### 6. Scope Boundaries
* **In Scope:** Electronic NAWIs, manual observation grids, logic evaluation, versioned reports, Offline cache resilience for standard testing.
* **Out of Scope (MVP):** Automatic Weighing Instruments (AWI), IoT automation / direct serial data port pulling, AI-driven evaluation engines, extraction of legacy un-digitized data, explicit multi-interval instruments (Phase 2).
