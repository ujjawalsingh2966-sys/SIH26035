# Implementation Roadmap & TODOs

This checklist details the phased delivery progression of the ANCRS program as mandated by the Multi-Phase Execution Plan. Proceed linearly. No software development is to begin until Phases 0–7 have achieved formal validation.

## Stage 1: Specifications, Modeling and Validation (Pre-Development)

### Phase 0: Regulatory Scope & Product Boundary Verification
- [x] Conclusively verify domain, regulatory, and mathematical boundaries against OIML R 76-1:2006.
- [x] Resolve critical blockers (math formulations, scope limits, report layouts, digital signatures).
- [x] Finalize `PHASE 0 STATUS: PASS`.

### Phase 1: SRS Baseline, Requirements Refinement & Requirements Freeze
- [x] Convert Phase 0 findings into an implementation-ready SRS baseline (`SRS_v0.2.md`).
- [x] Enforce explicitly strict inclusion/exclusion scopes & define arbitrary-precision math logic.
- [x] Generate traceability matrices, changelogs, open requirements, and acceptance logic.
- [x] Secure `PHASE 1 GATE VERDICT: PASS`.

### Phase 2: Domain Entity & Conceptual Data Architecture
- [ ] Finalize standard Entity Relationship Definitions (User, Instrument, Observation).
- [ ] Define comprehensive Entity Data Dictionaries limits (lengths, types).
- [ ] Solidify precise versioning links schemas mapping Test Cases to specific Rule Sets.

### Phase 3: Rule Engine & Explainability Architecture
- [ ] Conceptualize decoupled stateless evaluation pipeline inputs/outputs.
- [ ] Structure the exact return schemas for trace explanation modules.

### Phase 4: Workflow State Machine & Lifecycle Design
- [ ] Map all state transitions (Draft > Testing > Submitted > Approved / Returned > Archived).
- [ ] Attach formal Role-Based Access controls to every individual transition.

### Phase 5: Cryptographic Audit & Integrity Architecture
- [ ] Define logic for SHA-256 seal creation triggering on state approval.
- [ ] Define logic and architecture for append-only audit trail logging.
- [ ] Map detection behaviors on bit-flip and retroactive tampering alerts.

### Phase 6: Report Generation Engine & PDF Template Design
- [ ] Locate/Define exact standard annexure formats (if applicable).
- [ ] Prototype standard PDF layout structures utilizing dynamic test injections.

### Phase 7: Verification & Validation (V&V) Strategy
- [ ] Write the Master API testing plans and Unit test plans per phase.
- [ ] Construct Edge Case injection paths (out of bounds thresholds).
- [ ] Ensure all 50+ golden vectors are embedded into CI/CD structures.

---

## Stage 2: Code Implementation Gateway

### Phase 8: Core Mathematical & Rule Engine Implementation
- [ ] Boot analytical mathematical service employing `BigDecimal` precision logic.
- [ ] Automate V&V rules against golden test vectors (Requires 100% Pass rating).
- [ ] Codify the decoupled JSON-oriented rule consumption endpoint.

### Phase 9: Data Persistence Layer Implementation
- [ ] Initialize Database schemas with unchangeable constraint configurations.
- [ ] Implement multi-tier historical rule versioning architecture.
- [ ] Deploy append-only audit tracking functionality.

### Phase 10: Workflow & RBAC Service Implementation
- [ ] Build secure authentication pathways utilizing scoped JWTs.
- [ ] Install state-transitory boundaries mapped explicitly to user permissions.
- [ ] Implement rejection/correction looping logic logic endpoints.

### Phase 11: PDF Engine & Digital Certificate Generation
- [ ] Construct background rendering engine building pixel-accurate PDFs from data records.
- [ ] Apply post-render lockdown mechanics & cryptographic watermarking capabilities.

### Phase 12: User Interface & Frontend Observation Grid
- [ ] Initialize Progressive Web App (PWA) handling intermittent connections.
- [ ] Develop dynamic observation screens parsing exact mathematical limitations interactively.
- [ ] Expose transparent trace components showing technicians reasons for local fails natively.

### Phase 13: End-to-End System Integration & Metrological Audit
- [ ] Integrate GUI to API via automated E2E pipelines (Playwright/Cypress).
- [ ] Inject stress evaluations evaluating cross-state lock failures.
- [ ] Conduct overarching regulatory audits ensuring strict decoupling from hardware interactions.

### Phase 14: Hackathon Demonstration, Packaging & Documentation
- [ ] Provision scalable isolated sandbox implementations.
- [ ] Aggregate functional examples mapping inputs directly to standard OIML R76 results.
- [ ] Freeze documentation frameworks and ready deployable MVP instances.
