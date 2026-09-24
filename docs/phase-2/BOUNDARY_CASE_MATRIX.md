# Boundary Case Definition Matrix

This matrix formalizes the conceptual behavior of the deterministic application when mathematical thresholds push against edge conditions. 

## 1. Mathematical Value Boundaries

| Case Category | Scenario | Expected Logical Behavior |
| :--- | :--- | :--- |
| **Exact MPE Limit** | Evaluated error magnitude $|E_c|$ is EXACTLY mathematically equal to the mapped Table 6 MPE value | **PASS.** OIML R76 logic utilizes permissive inclusive bounding ($\le$). |
| **Micro-Exceedance MPE Limit** | Evaluated error magnitude $|E_c|$ is marginally above MPE via tiny factional evaluation (e.g., $E_c = 0.500000001e$ vs Limit $0.5e$) | **FAIL.** A technical failure no matter how fractionally minute, due to strict arbitrary math execution limits. |
| **MPE Threshold Jump Edge** | Evaluated load multiplier $m$ falls identically ON the class boundary tier (e.g., $m = 5,000$ on Class II). | **LOWER MPE RULES.** MPE rules apply to $\le m$, so falling precisely on $5000$ resolves to the lower $0.5e$ bounded rule. $5000.0001$ trips to $1.0e$. |
| **Zero Error Case** | Evaluated error exactly 0 | **PASS.** |
| **Minimum Capacity Floor** | Applied load $L$ operates beneath Min threshold block | **CONDITIONED.** Acceptable theoretically (evaluation logic functions cleanly at any vector), but system warns testing typically begins above Min. |
| **Maximum Capacity Overhead** | Applied load $L > \text{Max} + 9e$ | **BLOCKED - STRUCTURAL OVERLOAD.** Exceeds absolute maximal weighing zone definitions. |

## 2. Invalid Configuration Boundaries

| Case Category | Scenario | Expected Logical Behavior |
| :--- | :--- | :--- |
| **Missing Observation Array** | A sequence evaluates without explicit $\Delta L$ arrays provided in input mappings | **BLOCKED.** Test execution yields processing failure. Requires explicit 0 inputs natively. |
| **Unsupported Classifier** | An attempt is executed processing an array flagged as Class `MI` (multi-interval) | **BLOCKED.** State execution halts, throwing domain rejection outside defined Phase 2 logic bounds. |
