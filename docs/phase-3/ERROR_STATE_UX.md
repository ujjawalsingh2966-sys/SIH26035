# Error, Empty, and Blocked States

The UI must communicate missing connections natively through plain-language translations representing internal statutory conflicts. Technical exceptions are strictly hidden from users.

## 1. Statutory Blocks
Triggered natively when Phase 2 constraints bounce execution (e.g. AWI Classification Input).
* **Visuals:** Red banners scaling the top header. Heavy stop-sign icons.
* **Message Example:** *"OIML Compliance Error: Continuous automatic scales (AWI) are outside this module's testing jurisdiction."*
* **Resolution:** UI completely locks test processing until scope variables downgrade back to single-range NAWI.

## 2. Empty Matrices
Seen when opening a Dashboard without assigned queries or tests.
* **Visuals:** Desaturated generic weighting icons. 
* **Message:** *"No active test blocks remaining in your pipeline."*

## 3. Mathematical Validation Failures
Triggered when raw inputs form mathematically impossible boundaries (e.g. Min limits exceeding Max logic vectors).
* **Visuals:** Inline highlighted table cells. 
* **Message:** *"Conflict detected: Minimum Capacity limit cannot bypass declared Maximum threshold boundary."*
* **Resolution:** Re-edit directly inside the form field immediately.

## 4. Uncaught Exceptions (Network / API)
* **Message:** *"Connection dropped. Observations cached locally safely. Please reconnect prior to Verification Submissions."* (Handles generic API boundaries explicitly ensuring data safety assumptions).
