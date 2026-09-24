# Architecture & Technical Design

## 1. High-Level Architecture Overview
To meet the stringent regulatory, mathematical, and offline-capability requirements, a separated and modular layered architecture is proposed. Considering the offline-first requirement for laboratory networks, a client-site cached Progressive Web App (PWA) backed by a mature state-machine driven backend fits the use case.

### Architecture Layers
1. **Presentation & Application Layer (Client):** 
   - A Progressive Web App (PWA) facilitating local observation caching and optimistic UI capabilities to operate during intermittent network drops.
   - Synchronizes raw entries and cached states to the central ledger upon reconnection.
2. **Business Logic & Rules Engine (Backend):**
   - Headless state machine processing REST/GraphQL inputs. 
   - Enforces decoupled testing algorithms specifically decoupled from the database layers.
3. **Cryptography & PDF Subsystem:**
   - Standalone internal service managing SHA-256 seal generation and digitally signed PDF test case printing matching standard metrology templates.
4. **Data Persistence Ledger (Database):**
   - Stores master instrument data, audit states, rules, and mathematically exact numerical representations.

## 2. Technical Constraints
* **Precision Mathematics:** Strictly no standard `float` or `double` data types are permitted for computational metrics. Backends must use arbitrarily exact implementations (e.g., `BigDecimal` in Java/C#, `decimal.js` in Node). 
* **State Immutability:** Once a record is marked `Approved`, the system must prevent all updates. It should lock at a database configuration level or intercept all ORM writes to that test case.
* **Deterministic Execution:** The Rule Engine must perform as a pure function: `eval(InputData, Rules, e, d) -> PASS/FAIL Trace`. It must be untethered from side effects.
* **Hardware Interfacing Scope:** No physical serial port or IoT integrations should be present natively in MVP.

## 3. Data Models & Storage Requirements
The application maps the following domain relations. To avoid data erosion, observation results are bound strictly to specific Rule Engine entries.

* **User:** `id`, `name`, `password_hash`, `role` (Technician, ReviewingOfficer, SystemAdmin), `lab_location`.
* **Instrument Definition:** `id`, `manufacturer`, `model`, `class` (I, II, III, IIII), `max`, `min`, `verification_scale_interval (e)`, `actual_scale_interval (d)`.
* **Rule Engine Version (Immutable):** `id`, `version_label`, `activation_date`, `deactivation_date`, `config_payload` (JSON blob of MPE matrices and parameters).
* **Test Case:** `id`, `state` (Draft/Testing/Submitted/Returned/Approved/Archived), `instrument_id`, `assigned_rule_version_id`, `environment_conditions`, `cryptographic_hash`.
* **Observation:** `id`, `test_case_id`, `test_type` (Eccentricity, Repeatability, etc.), `applied_load`, `screen_indication`, `calculated_error`, `local_compliance_result`.
* **Attachment:** `id`, `test_case_id`, `blob_uri`, `content_type`.
* **Audit Trail:** `id`, `entity_reference`, `user_id`, `timestamp`, `old_state`, `new_state`, `action_type`. (Append-only storage).

## 4. APIs, External Dependencies & Services
* **Authentication/RBAC Service:** Manages JWT creation with embedded scopes, capable of revoking/expiring session tokens reliably.
* **Mathematical Eval Service:** Independent encapsulated domain processing testing criteria on exact decimals.
* **PDF Compilation Service:** Ingests the finalized test parameters and renders legally formatted reports. 
* **Cryptographic Oracle:** An internal routine that consumes finalized observation strings and constructs SHA-256 validation seals avoiding external third-party service latency where possible. 

## 5. Security, Privacy, Offline, and Reliability Configurations
* **Offline Capabilities:** The UI shall be built to withstand laboratory deadzones. It will write observation drafts to `IndexedDB`/`localStorage` (Offline Cache) dynamically. It cannot, however, initiate the 'Submit to Reviewer' phase offline since that demands synchronized rule-checksum validation.
* **Security & Roles:** Strict separation of duties. Users cannot self-escalate authorization levels. Sessions must be short-lived.
* **Immutability & Tamper Protection:**
  - Generating an Approved record produces a `SHA-256` signature encompassing: `hash(all_raw_observations + errors + rule_version)`.
  - Background integrity triggers will periodically re-hash the ledger data; if `current_hash != stored_hash`, the database will automatically flag the test case as physically tampered/corrupted.  
* **Audit Log:** An event-sourcing style append-only mechanism to strictly track what review officer signed which test at what specific UTC instance. Ensure `Audit Trail` records cannot be traditionally deleted by the application user.
