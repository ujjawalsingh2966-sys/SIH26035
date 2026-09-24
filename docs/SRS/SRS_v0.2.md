# Software Requirements Specification (SRS) - v0.2 Baseline

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) provides the comprehensive, implementation-ready baseline for the Automated NAWI Compliance & Reporting System (ANCRS). This document transitions the conceptual requirements of v0.1 into strict, deterministic engineering constraints validated during Phase 0/0B.

### 1.2 System Vision
ANCRS is a secure, web-based regulatory compliance platform engineered to digitize physical testing workflows for weighing instruments. It mathematical evaluates recorded laboratory data against version-controlled Legal Metrology rules (based on OIML R 76-1:2006) utilizing arbitrary-precision decimal operations, generates standardized OIML R 76-2:2007 compliant PDF reports, and secures all outputs using internal cryptographic seals.

### 1.3 Target Audience
This SRS is intended for software architects, backend/frontend engineers, Quality Assurance (QA) testers, and regulatory compliance reviewers overseeing system development.

## 2. Product Scope Boundaries

### 2.1 In Scope (MVP)
* **Instrument Scope:** Electronic, Single-Range Non-Automatic Weighing Instruments (NAWIs) covering Classes I, II, III, and IIII.
* **Testing Scope:** Execution of core OIML R 76-1 metrological tests: Weighing Performance, Eccentricity, Repeatability, Tare, and Zero-setting.
* **Paradigm:** Manual UI transcription of test observations by technicians inside a laboratory environment.
* **Reporting:** Generation of PDF Evaluation Reports matching OIML R 76-2:2007 data structures.
* **Offline Operation:** Local cache data capture for laboratories lacking persistent internet connectivity.
* **Auditability:** Internal SHA-256 sealing and immutable Rule Versioning.

### 2.2 Out of Scope (Phase 1/MVP Excluded)
* **Hardware Integrations:** IoT data capture, direct RS-232 serial polling, or automated telemetry from the test instruments.
* **Automatic Weighing Instruments (AWIs):** Checkweighers, catchweighers, or dynamic weighbridges governed by OIML R 51/R 134.
* **Mechanical/Complex Instruments:** Multi-interval, multiple-range, or traditional mechanical balances requiring analog interpolations.
* **External Cryptography:** Integration with external Indian IT Act Digital Signature Certificate (DSC) portals (e.g., eMudhra, NSWS APIs). 

## 3. Regulatory & Mathematical Baseline

### 3.1 Regulatory Precedence Hierarchy
The system calculates limits according to the following irrefutable hierarchy:
1. **Statutory Law:** The Legal Metrology Act, 2009.
2. **Administrative Law:** Legal Metrology (Approval of Models) Rules, 2011.
3. **Technical Baseline:** Seventh Schedule of LM (General) Rules, 2011 (which formally adopts OIML R 76-1:2006).
4. **Structural Reporting Baseline:** OIML R 76-2:2007 (Pattern Evaluation Report).

### 3.2 Mathematical Precision Doctrine
Standard floating-point (IEEE 754) arithmetic is **strictly prohibited** for metrological calculations. 
* All internal evaluators mapping the fundamental OIML equation ($E = I + 0.5e - \Delta L - L$) and corrected error calculations ($E_c = E - E_0 \le mpe$) **MUST** be written using an arbitrary-precision decimal library (e.g., `BigDecimal`, `decimal.js`).
* The exact OIML equations dictate intermediate accuracy; rounding happens exclusively at designated statutory endpoints, not during calculation.

## 4. Users and Roles

| Role | Authorized Actions | Restricted Actions |
| :--- | :--- | :--- |
| **Laboratory Technician** | Create records, input test observations, attach files, submit for review. | Cannot approve/certify reports. Cannot alter rules. |
| **Reviewing Officer** | Validate technician data, return to draft, grant final approval, export PDF. | Cannot input raw data directly (must return it). |
| **System Administrator** | Create/Retire Rule Versions, manage user access. | Cannot generate, input, or approve test reports. |

## 5. Functional Requirements

### 5.1 Instrument & Profile Management (FR-INST)
* **FR-INST-01:** The system shall restrict creation of test profiles exclusively to NAWI classifications.
* **FR-INST-02:** The system shall require the capture of Manufacturer, Model, Serial Number, Class (I-IIII), Min, Max, verification scale interval ($e$), and actual scale interval ($d$).
* **FR-INST-03:** The system shall logically validate relationships between Min, Max, $e$, and $d$ based on the selected OIML Class limits before allowing test commencement.

### 5.2 Test Observation Entry (FR-OBS)
* **FR-OBS-01:** The system shall implement specialized data grids mapping step-by-step to the exact tests designated in OIML R 76-1 Annex A.
* **FR-OBS-02:** The system shall prevent the submission of invalid datatypes (e.g., alpha characters in numeric fields).
* **FR-OBS-03:** The application shall utilize IndexedDB/Local Storage to allow offline continuation of data entry in the event of intermittent connection drops.

### 5.3 Calculation Engine (FR-CALC)
* **FR-CALC-01:** The engine shall calculate absolute indications and true dynamic error using exact-precision dependencies.
* **FR-CALC-02:** The system shall separate inputs defining load ($L$) against observed visual indication ($I$) and allow capture of standard extra mass ($\Delta L$) to accurately locate the changeover point error.

### 5.4 Rule Engine & MPE Evaluation (FR-RULE)
* **FR-RULE-01:** The Rule Engine must operate as a decoupled pure function: `eval(InputData, Ruleset ID) -> Result Trace`.
* **FR-RULE-02:** The system shall map testing loads dynamically into OIML Table 6 MPE limits (e.g., $\le 500e \rightarrow \pm 0.5e$, $>500e \text{ to } 2000e \rightarrow \pm 1.0e$).
* **FR-RULE-03:** The Engine shall generate a 'Compliance Verdict' at the cell row level and test level (e.g., PASS, FAIL).
* **FR-RULE-04:** Evaluations must provide an explainability trace verifying exactly why a result failed (e.g., "Result: FAIL. |1.8g| > 1.5g MPE for Class III Load 500e").

### 5.5 Workflow & State Machine (FR-WF)
* **FR-WF-01:** Test Cases shall adhere strictly to a discrete transition lifecycle: `DRAFT` $\rightarrow$ `TESTING` $\rightarrow$ `SUBMITTED` $\rightarrow$ `RETURNED` / `APPROVED`.
* **FR-WF-02:** A user acting as a Technician shall not possess the authorization to transition a state from `SUBMITTED` to `APPROVED`.
* **FR-WF-03:** Data entry and modification shall be programmatically disabled once a record enters the `SUBMITTED` or `APPROVED` states.

### 5.6 Cryptographic Sealing & Rule Versioning (FR-SEC)
* **FR-SEC-01:** The system shall irreversibly bind every Test Case to a specific, uniquely identifiable 'Rule Version ID' at the time of creation. Historical recalculations must use this exact locked version indefinitely.
* **FR-SEC-02:** Upon transitioning to the `APPROVED` state, the backend shall generate an internal SHA-256 cryptographic seal of the raw inputs and final evaluation states.
* **FR-SEC-03:** The architecture must allow future extensibility for appending IT Act standard external DSC signatures alongside the internal seal.

### 5.7 Report Generation (FR-REP)
* **FR-REP-01:** The system shall export final approved states into a structured PDF document.
* **FR-REP-02:** The PDF structural layout must map identically to the OIML R 76-2:2007 Pattern Evaluation Report.
* **FR-REP-03:** The generated PDF must visibly explicitly reference the exact mathematical Rule Version utilized and the resulting cryptographic SHA-256 seal.

## 6. Non-Functional Requirements (NFR)
* **NFR-01 (Performance):** The compliance evaluation pipeline shall execute entirely in $< 1000$ milliseconds for a complete test suite to ensure fluid UI interaction.
* **NFR-02 (Data Integrity):** Floating-point precision degradation shall be absolutely $0.000\%$ across all intermediate testing thresholds up to $10^{-8}$ decimal places.
* **NFR-03 (Auditability):** An immutable append-only event ledger shall trace every state transition, noting UTC Timestamp, User ID, and state change trigger.

## 7. Acceptance Criteria (Gate to Phase 8)
* **AC-1:** The SRS resolves all ambiguities regarding AWI inclusion, IoT hardware, external physical DSC signatures, and floating-point errors via explicit exclusionary instructions.
* **AC-2:** The SRS clearly outlines the exact architectural boundaries needed to build the Rule Engine (detached logic, strict typed inputs, JSON rule models).
* **AC-3:** Requirements dictate an offline-first capability at the web UI level with strict server-side logic enforcement upon reconnection. 
