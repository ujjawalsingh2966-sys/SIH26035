# UX Decision Log

| Mod ID | Decision | Phase 2 Source Driver | Trade-off / Consequence |
| :--- | :--- | :--- | :--- |
| **UX-DEC-01** | Strict Visual division between Raw Inputs vs Calculated values inside identical data grids. | `OBSERVATION_SPECIFICATION.md` | Trade-off: Expands horizontal screen requirements significantly on desktop, but entirely eliminates the hallucination hazard of assuming raw observations. |
| **UX-DEC-02** | Form progression blocks user from accessing Testing Matricies if `Is Manual` or `Is NAWI` are unset. | `INSTRUMENT_SCOPE_MATRIX.md` | Trade-off: Places friction aggressively at step 1 instead of allowing exploration, ensuring zero out-of-scope logic flows to the math engine. |
| **UX-DEC-03** | Explainability tooltips explicitly render evaluation algebra strings upon hover. | `COMPLIANCE_DECISION_SPECIFICATION.md` | Trade-off: UI appears highly dense/technical mathematically, but perfectly protects the reviewer's audit timeline obligations. |
| **UX-DEC-04** | Suppress all "Arbitrary Custom Test" capabilities natively in the UI. Tests generate via Matrix maps. | `TEST_APPLICABILITY_MATRIX.md` | Trade-off: Restricts technician autonomy significantly to guarantee standard rule paths aren't manually overwritten. |
| **UX-DEC-05** | Approval pushes immediately to static historical PDF representations rather than mutable UI. | `RULE_VERSION_SPECIFICATION.md` | Trade-off: Rework heavily relies on versioning/amendment pipelines instead of instant UI edits. |
