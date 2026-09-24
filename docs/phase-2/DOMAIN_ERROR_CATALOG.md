# Domain Error Catalog

This catalog outlines metrology-specific errors dictating logical rejection paths for the Phase 2 specification bounds.

| Error ID | Trigger / Condition | Metrological Meaning | Severity | Required Response / State | Source / Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ERR-DOM-01** | Instrument passed to engine lacks `Electronic` flag. | Hardware relies on mechanical interpolations banned from scope. | CRITICAL | Throw immediately; `BLOCKED` state. | Phase 0 Scope Restrictions |
| **ERR-DOM-02** | Observation payload missing $\Delta L$ weights array. | Impossible to deduce the analog conversion indication $P$. | CRITICAL | Halt mathematical calculation; flag GUI requirement mapping | OIML R76-1, A.4.4.3 |
| **ERR-DOM-03** | Max/Min/$e$ array conflicts logically (e.g. Min $\le 0$). | The statutory limits are physically broken or incorrectly typed. | CRITICAL | Prevent testing sequence natively; `BLOCKED`. | OIML R76-1 Table 3 |
| **ERR-DOM-04** | Input unit (`mg`) fails automatic base conversion boundaries. | Data scaling logic collapsed or unhandled string enum passed. | HIGH | Pause evaluation; request explicit $e$-matched string format. | Phase 2 Domain Unit Spec |
| **ERR-DOM-05** | Load $L$ injected exceeds $(\text{Max} + 9e)$. | Structurally overloads instrument limits, causing test invalidity. | CRITICAL | Throw rejection logic natively against payload. | OIML R76-1, 3.2 |
