# Regulatory Baseline

This document establishes the exact hierarchical regulatory and statutory foundation governing the metrological mathematical rules and reporting structures for the ANCRS Phase 2 Domain Specification.

## 1. Source Authority Hierarchy
As strictly enforced, if conflict arises between layers, the higher layer automatically overrides the lower layer:
1. Legal Metrology Act, 2009 (Statutory Supremacy)
2. Legal Metrology (Approval of Models) Rules, 2011 (Administrative & Process Rules)
3. Legal Metrology (General) Rules, 2011 (Seventh Schedule verbatim adopting OIML R 76-1:2006 for definitions and MPE limits)
4. OIML R 76-1:2006 (Metrological and Technical Requirements for NAWI)
5. OIML R 76-2:2007 (Test Report Format)

## 2. Regulatory Baseline Entities

### 2.1 Indian Statutory Law
* **Source ID:** IND-LMA-2009
* **Document:** Legal Metrology Act, 2009
* **Authority:** Government of India, Ministry of Consumer Affairs
* **Version:** 2009 (as amended)
* **Relevant Context:** Enforces model approval mandate under Section 22; defines strict liability for non-compliant software and record falsification.
* **Role in Software:** Governs absolute security bounds (cryptographic sealing required) and audit non-repudiation.
* **Status:** VERIFIED

### 2.2 Indian Administrative Regulations
* **Source ID:** IND-LMR-2011-MODEL
* **Document:** Legal Metrology (Approval of Models) Rules, 2011
* **Authority:** Department of Consumer Affairs (Legal Metrology Division)
* **Version:** 2011 (with latest amendments)
* **Relevant Context:** Governs approval sequence, testing authority actions, and lifecycle states (Draft $\rightarrow$ Submitted $\rightarrow$ Approved).
* **Role in Software:** Defines state machine boundaries and workflow progression limits in Phase 4.
* **Status:** VERIFIED

### 2.3 Indian Metrological Technical Rules
* **Source ID:** IND-LMR-2011-GEN
* **Document:** Legal Metrology (General) Rules, 2011 (Seventh Schedule)
* **Authority:** Department of Consumer Affairs
* **Version:** 2011
* **Relevant Context:** Officially incorporates OIML R 76-1 limits into the Indian legal framework.
* **Role in Software:** Directly proxies OIML R 76-1 as the primary data source for mathematical rules.
* **Status:** VERIFIED

### 2.4 International Metrological Recommendation (Core Math)
* **Source ID:** OIML-R76-1-2006
* **Document:** OIML R 76-1: Non-automatic weighing instruments - Part 1: Metrological and technical requirements - Tests
* **Authority:** International Organization of Legal Metrology (OIML)
* **Version:** 2006 (E)
* **Relevant Context:** Defines exact formulae (e.g. $E = I + 0.5e - \Delta L - L$), rounding rules, calculation of limits (MPE), and test vector generation (Annex A).
* **Role in Software:** Foundation of all algorithms, calculations, test preconditions, and MPE boundary verification logic.
* **Status:** VERIFIED

### 2.5 International Reporting Recommendation
* **Source ID:** OIML-R76-2-2007
* **Document:** OIML R 76-2: Non-automatic weighing instruments - Part 2: Test report format
* **Authority:** OIML
* **Version:** 2007 (E)
* **Relevant Context:** Defines the precise structural layout for reporting OIML errors and compliance metadata.
* **Role in Software:** Base layout mapping for the UI Observation Grids and final PDF output blocks.
* **Status:** VERIFIED

## 3. Ambiguities & Conflicts
* **Conflict Statement:** Visual representation on PDF deliverables strictly depends on individual State LM Directorates, but the data schema relies on OIML R 76-2.
* **Resolution:** Application outputs raw OIML R 76-2 data structures. A headless visual wrapper is deferred to post-MVP configuration mappings to prevent mathematical delays.
