# Golden Reference Test Cases Specification

This document presents non-automated, trusted domain tests dictating absolute reference outputs future developers use to assert engine accuracy. 

*Note: Due to the unavailability of certified RRSL benchmark test datasets at Phase 2, all references below are formally labeled SYNTHETIC. They rely exclusively on verifiable manual R76 execution constraints for validation.*

## 1. Class III - Normal Passing Evaluation (SYNTHETIC)
* **Case ID:** `GT-01-PASS-III-NOR`
* **Configuration:** Class: III, Max: 15kg, Min: 100g, e: 5g, d: 5g
* **Test:** Weighing Evaluation (`TEST-WEIGH`)
* **Inputs:** Load $L = 5\text{kg}$ (5000g)
* **Observations:** $I = 5005\text{g}$, $\Delta L = 3\text{g}$, $E_0 = 0\text{g}$
* **Derived Analog:** 
  * $P = I + 0.5e - \Delta L$ 
  * $P = 5005 + 2.5 - 3 = 5004.5\text{g}$
  * $E = P - L$ = $5004.5 - 5000 = +4.5\text{g}$
  * $E_c = E - E_0 = +4.5\text{g}$
* **Rule Selection:** $m = 5000 / 5 = 1000$. Class III Table 6 ($500 \le m \le 2000$) dictates $\text{MPE} = 1.0e = 5\text{g}$.
* **Comparison:** $|+4.5| \le 5$
* **Result:** `PASS`
* **Boundary Context:** Standard mid-range normal test

## 2. Class III - Normal Failing Evaluation (SYNTHETIC)
* **Case ID:** `GT-02-FAIL-III-NOR`
* **Configuration:** Same as GT-01. Class III, e=5g.
* **Test:** Weighing Evaluation (`TEST-WEIGH`)
* **Inputs:** Load $L = 5\text{kg}$ (5000g). ($m = 1000$, $\text{MPE} = 5\text{g}$)
* **Observations:** $I = 5010\text{g}$, $\Delta L = 2\text{g}$, $E_0 = 0\text{g}$
* **Derived Analog:** 
  * $P = 5010 + 2.5 - 2 = 5010.5\text{g}$
  * $E_c = 5010.5 - 5000 = +10.5\text{g}$
* **Comparison:** $|+10.5| > 5$
* **Result:** `FAIL`
* **Boundary Context:** Error blatantly out of strict boundary zone

## 3. Class II - Exact Mathematical Boundary (SYNTHETIC)
* **Case ID:** `GT-03-PASS-II-BNDRY`
* **Configuration:** Class: II, Max: 300g, Min: 0.1g, e: 0.01g
* **Test:** Weighing Evaluation (`TEST-WEIGH`)
* **Inputs:** Load $L = 200\text{g}$.
* **Observations:** $I = 200.00\text{g}$, $\Delta L = 0.00\text{g}$, $E_0 = 0.005\text{g}$
* **Derived Analog:** 
  * $P = 200.00 + 0.005 - 0 = 200.005\text{g}$
  * $E = 200.005 - 200 = 0.005\text{g}$
  * $E_c = 0.005 - 0.005 = 0.000\text{g}$
* **Rule Selection:** $m = 200 / 0.01 = 20,000$. Class II Table 6 ($5,000 \le m \le 20,000$) dictates $\text{MPE} = 1.0e = 0.01\text{g}$.
* **Comparison:** $|0.000| \le 0.01$
* **Result:** `PASS`
* **Boundary Context:** Extremely strict high-precision fractional class execution logic. Defines the importance of Arbitrary Decimals.
