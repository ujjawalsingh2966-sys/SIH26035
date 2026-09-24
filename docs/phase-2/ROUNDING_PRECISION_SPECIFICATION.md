# Rounding & Precision Specification

This section controls how the conceptual mathematical model treats float precision defects inherent in primitive computer science operators, ensuring compliance with legal metrology statutory bounds.

## 1. What Values Must Remain Exact
All internally derived intermediate calculations generated within the evaluation space:
* $P = I + 0.5e - \Delta L$
* $E = P - L$
* $E_c = E - E_0$
* $m = L / e$

**MUST REMAIN PERFECTLY EXACT (Infinite Precision)** until terminal boundary evaluation against the dynamically fetched MPE rule. Rounding these internal values causes cascading truncation failures resulting in incorrect PASS/FAIL outputs.

## 2. Where Rounding Occurs
Rounding happens **strictly** during final deterministic evaluation displays if the reporting template explicitly bounds display integers (e.g., UI display rounding output strings merely for aesthetics). At this layer, the backend Boolean logic comparison (e.g. `is $E_c \le mpe$`) relies on the infinite precision variable.

## 3. Boundary Case Evaluation logic
* **Exact Limit Tolerance:** When evaluating exact boundaries (e.g., calculated $E_c = 0.5 e$), if the relevant MPE limit resolves natively to precisely $0.5 e$, this constitutes a LEGAL PASS. 
* **Mathematically:** $E_c \le \text{MPE}$ (Strictly inclusive bounds).

## 4. Handling Negative Errors
OIML Table 6 explicitly treats negative margins symmetrically.
$mpe_{absolute} = \pm limit$.
Evaluation compares absolute magnitude variables: $|E_c| \le \text{MPE}_{limit}$.

## 5. Technology Imposition Layer
Future code architecture MUST prohibit primitive generic floating points (e.g. JavaScript generic `number` or Java `float`). Calculations must enforce strings or object-represented fractions utilizing specialized classes (like `BigDecimal` or `decimal.js`).
