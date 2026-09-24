# Conflict Resolution Matrix

This specification dictates the strictly defined fallback parameters enabling absolute resolution when conditions clash, eliminating silent assumptions that developers commonly default to.

| Condition / Conflict Trigger | Required Domain Action | Metrological Result State | Escalation Directive |
| :--- | :--- | :--- | :--- |
| **Ambiguity in Formula Inputs** (e.g. missing $\Delta L$ or $e$) | The system MUST NOT substitute $0$. | `BLOCKED` | Rejects payload automatically to validation layer. |
| **Divergence of Dual Rules** (e.g. International OIML says X, Indian LM says Y) | Statutory hierarchy overrides strictly. The LM Act boundaries overwrite purely technical OIML ones without alerting. | Normal (`PASS`/`FAIL`) | N/A (Hardcoded statutory override). |
| **Load Multiplier Precision Boundaries** (e.g. integer bounds crossing float variances dynamically) | Enforce strictly the exact Arbitrary Precision boundary mappings. Floor the comparison bounds definitively via explicit definitions (see Matrix Rules). | Normal (`PASS`/`FAIL`) | Developer testings ensure fractional bounds check exactly to decimal.js boundaries. |
| **Unmapped Instrument Classifications** (e.g., AWI or Multi-interval payload hits single-range endpoint) | Core Engine rejects processing. No rule applicability route mapped. | `BLOCKED` | Rejects payload automatically. |
| **Rule Version Ambiguity** (e.g., execution lacks bound Rule Version ID mapping) | Defaults automatically strictly to the latest `ACTIVE` Rule Set Version for processing. | Normal (`PASS`/`FAIL`) | Historical records without flags inherit recent standards warning operators visually. |
