# Master Regulatory Traceability Matrix (Phase 2)

This matrix maps every specification element defined across Phase 2 directly to its corresponding statutory requirement under the Legal Metrology Framework and OIML R 76-1:2006.

| Spec Item ID | Specification Title | Statutory Reference | OIML R 76-1:2006 Clause | LM Rules 2011 Reference | Traceability & Compliance Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SPEC-REG-BASE** | Regulatory Baseline & Statutory Hierarchy | Legal Metrology Act, 2009 | Section 3 | General Rules, Section 2 | Establishes absolute legal supremacy of national act over technical recommendations. |
| **SPEC-INST-SCOPE** | Instrument Scope Matrix | LM (Approval of Models) Rules, 2011 | Clause 2.1 | Seventh Schedule, Part I | Single-range electronic NAWI boundary definitions (Classes I, II, III, IIII). |
| **SPEC-TEST-CAT** | Test Catalog | OIML R 76-1:2006 | Clause 3.5, 3.6, A.4 | Seventh Schedule, Heading B | Standard testing procedures for Weighing, Eccentricity, Repeatability, Tare, and Zero. |
| **SPEC-TEST-APP** | Test Applicability Matrix | OIML R 76-1:2006 | Clause 3.5, Table 3 | Seventh Schedule, Rule 4 | Mandatory assignment of test patterns based on accuracy class and physical topology. |
| **SPEC-INP-DEF** | Test Input Specifications | OIML R 76-1:2006 | Clause 3.2, 3.3 | Seventh Schedule, Rule 2 | Definition of formal input bounds ($Max$, $Min$, $e$, $d$, load vector, test sequence). |
| **SPEC-OBS-DEF** | Observation Specifications | OIML R 76-1:2006 | Clause A.4.4.3 | Seventh Schedule, Method A | Separation of raw observations ($I, \Delta L, E_0$) from analog true values ($P, E, E_c$). |
| **SPEC-INST-LIM** | Instrument Limits Specification | OIML R 76-1:2006 | Table 3 | Seventh Schedule, Table 1 | Scale interval verification, minimum capacity boundaries, and $n = Max / e$ constraints. |
| **SPEC-CALC-CORE** | Calculation Specification | OIML R 76-1:2006 | Clause A.4.4.3 | Seventh Schedule, Method A | True indication ($P = I + 0.5e - \Delta L$), initial error ($E = P - L$), and corrected error ($E_c$). |
| **SPEC-MPE-MAT** | MPE Rule Matrix | OIML R 76-1:2006 | Clause 3.5.1, Table 6 | Seventh Schedule, Table 2 | Step limits ($\pm 0.5e, \pm 1.0e, \pm 1.5e$) mapped against verification load multiplier $m = L/e$. |
| **SPEC-PREC-RND** | Rounding & Precision Spec | Technical Metrology Guidance | Non-statutory / Math | N/A | Mandate for arbitrary-precision decimal representation without intermediate IEEE-754 rounding. |
| **SPEC-UNIT-NORM** | Unit Specification | Legal Metrology Act, 2009 | Section 11 | General Rules, Schedule 1 | Enforcement of SI units and verified non-lossy conversions to base unit ($e$). |
| **SPEC-BND-MAT** | Boundary Case Matrix | OIML R 76-1:2006 | Clause 3.5.1 | Seventh Schedule, Table 2 | Strict equality evaluation ($|E_c| \le MPE$) and micro-exceedance failure thresholds. |
| **SPEC-DEC-TRACE** | Compliance Decision & Trace | Legal Metrology Act, 2009 | Section 24 | General Rules, Verification | Structural requirement for immutable evaluation audit traces and clear state verdicts. |
| **SPEC-RVER-ARCH** | Rule Versioning Specification | Evidence Act / LM Rules | Standard Quality ISO 17025 | N/A | Semantic version binding of rules for historical reproducibility and audit stability. |
| **SPEC-CONF-RES** | Conflict Resolution Matrix | Statutory Hierarchy Rules | N/A | Act Sec 3, Rules Sec 2 | Elimination of fallback assumptions; deterministic rejection on missing or conflicting inputs. |
| **SPEC-GOLD-CAS** | Golden Reference Cases | OIML R 76-2:2007 | Model Approval Format | Seventh Schedule | Reference vectors across Classes I-IIII establishing verifiable expected outcomes. |
| **SPEC-DOM-ERR** | Domain Error Catalog | Software Quality Metric | N/A | N/A | Enumerated rejection codes and terminal handling paths for invalid metrological states. |
