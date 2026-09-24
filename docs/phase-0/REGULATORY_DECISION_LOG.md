# Regulatory Decision Log

**Decision ID:** REG-001
**Question:** Does OIML R 76 apply equivalently to all weighing instruments (e.g., weigh-in-motion checkweighers vs retail scales)?
**Evidence:** OIML R 76 strictly scopes to "Non-automatic weighing instruments" (NAWI) indicating user intervention is necessary during the weighing process. "Automatic Weighing Instruments" (AWIs) encompass distinct OIML standards (e.g., R 51, R 134).
**Conclusion:** R 76 only covers NAWIs.
**Confidence:** HIGH
**Implication for software:** The engine must enforce a strict initial gateway restricting instruments to NAWI classifications, automatically flagging AWIs as out of scope.
**SRS impact:** Aligns with current SRS bounds.

---
**Decision ID:** REG-002
**Question:** What is the authoritative edition of OIML R 76 being utilized for testing?
**Evidence:** OIML R 76-1: 2006 (E) is the most recent established release document detailing calculation traces and MPE definitions for NAWIs globally. OIML TC 9 / SC 1 maintains draft revisions, but they hold no formal legal standing.
**Conclusion:** R 76-1 2006 (E) functions as the definitive technical standard baseline.
**Confidence:** HIGH
**Implication for software:** 2006 tests are directly modeled. A rule versioning module must be built to allow switching to any updated Indian regulation or future OIML adoptions transparently, but immediate logic will lock to 2006.
**SRS impact:** Sets the explicit mathematical baseline.

---
**Decision ID:** REG-003
**Question:** What is the role of Indian legal requirements relative to OIML?
**Evidence:** The Legal Metrology Act (2009) and corresponding Model Approval Rules (2011) define statutory workflow law. Seventh Schedule of LM (General) Rules, 2011 explicitly copies technical specs.
**Conclusion:** Indian statutory implementations take primary operational precedence. However, for technical calculation logic (digital indications), India utilizes OIML mathematical procedures directly.
**Confidence:** HIGH
**Implication for software:** The Rule Engine explicitly tags rule sets acknowledging OIML tests as technical derivations fulfilling Indian legal obligations.
**SRS impact:** Clarifies the hierarchy of LM Rules 2011 > OIML technical mapping.

---
**Decision ID:** REG-004
**Question:** Is the report template strictly prescribed?
**Evidence:** The Legal Metrology (Approval of Models) Rules (2011) specify the final "Certificate" format, but do not dictate the granular aesthetic of the "Test Report" layout generated inside the RRSL. OIML R 76-2:2007 "Pattern Evaluation Report" outlines the exact data structure internationally.
**Conclusion:** OIML R 76-2 format defines the structural data components perfectly. The exact aesthetic aesthetic for Indian government RRSL forms remains TBD.
**Confidence:** HIGH
**Implication for software:** PDF generation will structure data identical to R 76-2, but the visual template framework will remain decoupled.
**SRS impact:** Amends the 'TBD' marking on report structures to acknowledge R 76-2 structural conformity.

---
**Decision ID:** REG-005
**Question:** Are formal external digital signatures mandatory for MVP approvals?
**Evidence:** The exact requirements for DSC tokens (per Indian IT Act 2000) vs internal application-generated SHA-256 seals have not been verified via portal documentation. 
**Conclusion:** Immutable audit requirement means SHA-256 cryptographic locking on generated reports is MANDATORY. Explicit integration with external IT Act DSC tokens is classified as MVP-DEFERRED.
**Confidence:** HIGH
**Implication for software:** Standardize an internal SHA-256 digital watermark mechanism. Build abstraction handlers allowing future integration of external DSC wrappers post-MVP.
**SRS impact:** Ensures cryptographic lockdown while unblocking the testing phase.

---
**Decision ID:** REG-006
**Question:** How is absolute error determined for rounding bounds on digital electronic indications?
**Evidence:** OIML R 76-1:2006, Annex A.4.4.3 specifically dictates determining error prior to rounding using changeover point calculation: $E = I + 0.5e - \Delta L - L$. Intermediate rounding before evaluating zero-corrected error ($E_c$) against MPE is absent/forbidden.
**Conclusion:** The Indian standard does not override this sub-equation. 
**Confidence:** HIGH
**Implication for software:** Imposes requirement of true-precision decimal mathematics (like `BigDecimal`), eliminating raw floating-point calculation to prevent boundary threshold errors.
**SRS impact:** Validates stringent dependency on numerical exactitude for core functions.
