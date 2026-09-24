# SRS Audit Report (v0.1 to v0.2 Transition)

## 1. Executive Summary
This audit evaluates the baseline `SIH_NAWI_SRS_and_PhasePlan.md` (v0.1) against the verified mathematical, regulatory, and architectural boundaries established during Phase 0 / 0B. The objective is to identify contradictions, ambiguities, and deferred decisions in the baseline SRS that must be rectified in the implementation-ready `SRS_v0.2.md`.

## 2. Identified Contradictions & Ambiguities

### 2.1 Scope Ambiguity: Instrument Complexity
* **Location in v0.1:** Section 3.1 (In Scope) & Section 7 (Instrument Scope)
* **Finding:** The v0.1 SRS defines the scope broadly as "NAWI", but flags mechanical NAWIs as "TBD" and does not explicitly exclude multiple-range or multi-interval instruments.
* **Phase 0 Resolution:** Phase 0 established that standardizing testing arrays requires strict limitation to Electronic Single-Range NAWIs.
* **Required SRS v0.2 Action:** Mandate the MVP instrument boundaries exclusively to Electronic, Single-Range NAWIs (Classes I, II, III, IIII).

### 2.2 Template & Report Ambiguity
* **Location in v0.1:** Section 16 (Report Requirements) & Section 29 (Open Questions Q-01)
* **Finding:** The exact format of the final PDF report was left "TBD", blocking data structure development for the export sequence.
* **Phase 0 Resolution:** Indian RRSL forms structurally mirror the international standard OIML R 76-2:2007 Pattern Evaluation Report.
* **Required SRS v0.2 Action:** Adopt OIML R 76-2:2007 as the definitive structural data model for PDF reporting.

### 2.3 Hardware Integration Contradiction
* **Location in v0.1:** Section 3.2 (Out of Scope) vs. Section 21 (Hardware & Connectivity)
* **Finding:** Section 3.2 excludes Automatic test execution, but Section 21 and Section 26 defer "Direct IoT" to Phase 2+, leaving its Phase 1 status ambiguous.
* **Phase 0 Resolution:** Direct serial / IoT polling introduces hardware-specific physical dependencies incompatible with the core MVP calculation algorithm.
* **Required SRS v0.2 Action:** Explicitly ban hardware polling from the MVP; mandate a purely manual data entry paradigm.

### 2.4 Cryptographic Execution Blockers
* **Location in v0.1:** Section 19 (Security) & Section 29 (Open Questions Q-03)
* **Finding:** The mechanism for digital signatures was ambiguous, potentially demanding blocking integration with external DSC IT Act APIs.
* **Phase 0 Resolution:** An internal application layer SHA-256 seal satisfies the immutable audit requirement for the MVP.
* **Required SRS v0.2 Action:** Mandate internal SHA-256 seal mechanics and explicitly defer external government API integration.

### 2.5 Metrological Mathematics (Rounding)
* **Location in v0.1:** Section 14 (Calculation Requirements) & Section 29 (Open Questions Q-02)
* **Finding:** The specific rounding policy inside of the changeover point error equation $E = I + 0.5e - \Delta L - L$ was marked "TBD".
* **Phase 0 Resolution:** OIML R 76-1:2006 math applies globally; there is no localized Indian equation deviation.
* **Required SRS v0.2 Action:** Codify the exact OIML equations and enforce arbitrary-precision numerical limits (`BigDecimal` logic) across all compliance determinations.

## 3. Conclusions
The foundational v0.1 SRS provided an accurate conceptual workflow, but lacked the rigorous technical narrowing necessary to commence Phase 8 development. By enforcing the boundaries identified above, `SRS_v0.2.md` will serve as a frozen, implementation-ready contract for the NAWI Compliance Automation engine.
