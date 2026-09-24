# NAWI R76 Test Catalog

Based on the official OIML R 76-1:2006 parameters and Indian Legal Metrology Rules, the following is the master test catalog of tests required.

## 1. Master Test Catalog

| Test ID | Test Name | Official Reference | Purpose | Preconditions | Calculation Required? | Compliance Criterion | Validation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-WEIGH** | Weighing Performance | R76-1, A.4.4/A.4.5 | Determine error of indication under increasing and decreasing loads. | Zero balanced, stable | YES ($E, E_c$) | $E_c \le mpe$ | VERIFIED |
| **TEST-ECC** | Eccentricity | R76-1, A.4.7 | Verify if placing loads off-center impacts the resulting display. | Instrument leveled | YES ($E, E_c$) | $E_c \le mpe$ | VERIFIED |
| **TEST-REP** | Repeatability | R76-1, A.4.10 | Verify consistency of readings when the same load is applied multiple times. | Same load applied sequentially | YES (Max difference) | $E_{max} - E_{min} \le mpe$ | VERIFIED |
| **TEST-TARE** | Tare balancing | R76-1, A.4.6 | Verify tare zero and indication under tare combinations. | Tare active | YES ($E, E_c$) | $E_c \le mpe$ | VERIFIED |
| **TEST-ZERO** | Zero-setting limit | R76-1, A.4.2.3 | Confirm initial zero setting mechanism bounds (e.g. $\le 20\%$ Max). | Empty load receptor | YES | Value $\le$ percentage | VERIFIED |

## 2. Advanced / Deferred Tests
The following tests are deferred from the immediate algorithmic implementation due to environmental complexities out of MVP scope:
* **TEST-TEMP:** Static Temperatures / Temperature effects on no-load indication (A.5.3.1).
* **TEST-CREEP:** Time-dependent behavior / Creep (A.4.11).
* **TEST-ELEC:** Electrical disturbances / Supply voltage variations (A.5.4).
