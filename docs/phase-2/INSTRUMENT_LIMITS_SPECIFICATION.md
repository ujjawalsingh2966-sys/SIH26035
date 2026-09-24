# Max / Min / e / d / Accuracy Class Specification

## 1. Parameter Definitions & Constraints

| Parameter | Formal Meaning | Source | How Obtained | Validation / Constraints | Impact on Algorithm |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Class** | Metrological accuracy class | OIML R76-1, 3.1.1 | Instrument metadata plate | Must be I, II, III, or IIII. | Dictates the row used in the MPE mapping Table 6. |
| **Max** | Maximum weighing capacity | OIML R76-1, 3.1 | Instrument metadata plate | Cannot be less than Min. Limits maximum $L$ injection. | Defines upper bounds for Eccentricity load ($1/3$ Max). |
| **Min** | Minimum capacity | OIML R76-1, 3.1 | Instrument metadata plate | Must be $>0$. Must correlate with $e$ constraints. | Defines the lowest valid $L$ threshold for testing. |
| **e** | Verification scale interval | OIML R76-1, 3.1.2 | Instrument metadata plate | Expressed as $1 \times 10^k$, $2 \times 10^k$, or $5 \times 10^k$. | Used as unit of measurement ($m = Load / e$) to select MPE threshold. Constant in $0.5e$ math. |
| **d** | Actual scale interval | OIML R76-1, 3.1.2 | Instrument metadata plate | Must fulfill $d \le e$. Defines exact display step. | Often implies conditions on where $\Delta L$ increments can be mathematically defined. |

## 2. Relational Verification Rules (Pre-Computation)

Before any test matrix can execute, the following configuration dependencies must cryptographically pass validation checks purely off $e$ and Class constraints (OIML R76-1, Table 3):

* **Class I Constraints:** Min load $\ge 100e$. Number of intervals $n \ge 50,000$.
* **Class II Constraints:** Min load $\ge 20e$ (if $e \ge 0.1g$) or $\ge 50e$ (if $e \le 0.05g$). $n \le 100,000$.
* **Class III Constraints:** Min load $\ge 20e$. $n \le 10,000$.
* **Class IIII Constraints:** Min load $\ge 10e$. $n \le 1,000$.

*Note: The number of verification scale intervals is determined dynamically as $n = \text{Max} / e$.*
