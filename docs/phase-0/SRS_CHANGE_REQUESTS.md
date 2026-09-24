# Required SRS Changes After Phase 0B

## Change 1
* **SRS section:** Section 3.1 & 7 (Instrument Scope)
* **Current statement:** Implicitly includes NAWI scope without isolating interface types or range limits.
* **Problem:** Ambiguity on whether mechanical and digital balancing NAWIs warrant distinct observation UI paradigms. Mechanical NAWIs do not utilize identical digital error evaluation methods.
* **Verified evidence:** Modern OIML models structurally bifurcate calculations requiring $\Delta L$ variables vs raw indication estimates.
* **Proposed corrected requirement:** Explicitly confine Phase 1 MVP to "Electronic, Single-Range Non-Automatic Weighing Instruments". Multi-interval and mechanical scopes relegated to Phase 2.
* **Priority:** CRITICAL
* **Impact:** Drastically reduces frontend validation edge cases and stabilizes math tests.
* **Reason:** Ensures observation entry algorithms operate safely upon standardized digital input expectations.

## Change 2
* **SRS section:** Section 16 & 29 (Reporting & Templates)
* **Current statement:** Legal Metrology template specifics marked TBD.
* **Problem:** Defining exact layout and output presentation parameters remains ambiguous without an explicit target PDF matrix.
* **Verified evidence:** RRSL laboratory generation mimics OIML R 76-2 Test Reports internally while external certificates follow the Eighth Schedule. 
* **Proposed corrected requirement:** Mandate the structural organization of PDF outputs to align strictly with the Data Models of: "OIML R 76-2:2007 Pattern Evaluation Report". Final letterhead graphics remain flexible.
* **Priority:** HIGH
* **Impact:** Provides an exact data layout schema for the HTML/PDF generator.
* **Reason:** Allows the core mapping and export engine development to commence unblocked by aesthetic letterhead unknowns.

## Change 3
* **SRS section:** Section 19 (Security) & Section 29
* **Current statement:** Authentication and digital sealing assume internal SHA-256 seals pending information on Indian IT Act specific DSCs.
* **Problem:** Attempting to force Government API signatures stalls development when infrastructure credentials are fundamentally unavailable to isolated prototypes.
* **Verified evidence:** Cryptographic locking protects the internal immutability requirement without demanding external government DSC validation integration initially.
* **Proposed corrected requirement:** Explicit requirement stating: "MVP shall implement internal computational SHA-256 validation seals linking report states to input traces, operating with abstract interfaces extensible to external IT Act DSC APIs."
* **Priority:** HIGH
* **Impact:** Ensures the system builds flexibly without being completely blocked by lack of external signature API keys.
* **Reason:** Guarantees audit compliance internally.

## Change 4
* **SRS section:** Section 21 (Hardware & Connectivity)
* **Current statement:** References potential IoT interfaces or "Smart" integrations ambiguously.
* **Problem:** True hardware connectivity across proprietary scales disrupts rapid MVP creation.
* **Verified evidence:** Standard OIML tests are physically conducted; values are visually read and transcribed by technicians.
* **Proposed corrected requirement:** Explicitly enforce a manual UI data-entry paradigm for Phase 1. Ban serial/TCP load-cell polling requirements.
* **Priority:** HIGH
* **Impact:** Isolates workload solely to web interface parameters.
* **Reason:** Removes physical hardware dependency bottlenecks.