# MPE Rule Matrix (OIML R76-1 Table 6)

The Maximum Permissible Error (MPE) limit is dynamically determined based on the instrument's designated accuracy Class and the active weight of the Nominal Load ($L$) represented as a multiplier of $e$ ($m = L / e$).

## 1. MPE Determination Logic Matrix

This matrix governs the acceptable tolerance output bound limits. The evaluation engine compares $|E_c|$ against the determined MPE block.

| MPE Tier Limit | Class I Load Boundary ($m$) | Class II Load Boundary ($m$) | Class III Load Boundary ($m$) | Class IIII Load Boundary ($m$) | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0.5 e** | $0 \le m \le 50,000$ | $0 \le m \le 5,000$ | $0 \le m \le 500$ | $0 \le m \le 50$ | OIML R76-1 Table 6 |
| **1.0 e** | $50,000 < m \le 200,000$ | $5,000 < m \le 20,000$ | $500 < m \le 2,000$ | $50 < m \le 200$ | OIML R76-1 Table 6 |
| **1.5 e** | $200,000 < m$ | $20,000 < m \le 100,000$ | $2,000 < m \le 10,000$ | $200 < m \le 1,000$ | OIML R76-1 Table 6 |

## 2. In-Service vs. Initial Verification MPE
There are distinct stages of software certification testing (Initial Verification vs. In-Service Inspections).
* **Initial Verification MPE:** Used directly from the Table 6 boundaries (e.g. $1.0e$).
* **In-Service MPE:** Typically scaled to double the initial limits ($2 \times$ MPE). MVP Scope defaults solely to Initial Verification standard multipliers unless specifically flagged via workflow state.

## 3. Boundary Behavior Evaluator
* **Logic State:** The boundary operators are strictly "less than or equal to" ($\le$) on the upper bounds, and strictly "greater than" ($<$) on the lower thresholds.
* **Resolution Rule:** If $m = 5,000$ on a Class II instrument, the MPE bound strictly resolves to $0.5e$. If $m = 5,000.0001$, it steps to $1.0e$.
