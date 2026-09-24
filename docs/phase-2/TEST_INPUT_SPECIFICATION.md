# Test Input Specification

This domain specification limits the absolute required inputs (preconditions data) for executing tests across the MVP. Conceptually, this defines the input payload an evaluation function will consume.

## 1. Core Instrument Parameters

| Input ID | Name | Definition | Unit | Conceptual Data Type | Required | Source | Role in Algorithm | Validation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **INP-CLASS** | Accuracy Class | The metrological class (I, II, III, IIII) | N/A | Enum | YES | OIML R76-1, 3.1.1 | Dictates MPE threshold lookup table | VERIFIED |
| **INP-MAX** | Max Capacity | Maximum weighing capacity | g / kg | Arbitrary Precision Numeric | YES | OIML R76-1, 3.1 | Upper bound validation, determines load limits | VERIFIED |
| **INP-MIN** | Min Capacity | Minimum weighing capacity | g / kg | Arbitrary Precision Numeric | YES | OIML R76-1, 3.1 | Identifies lower operational bound | VERIFIED |
| **INP-E** | Verification Interval | $e$, the certified interval used for law | g / kg | Arbitrary Precision Numeric | YES | OIML R76-1, 3.1 | Divider for MPE mapping and $0.5e$ constants | VERIFIED |
| **INP-D** | Actual Interval | $d$, the real scale interval display step | g / kg | Arbitrary Precision Numeric | YES | OIML R76-1, 3.1 | Rounding target resolution limit | VERIFIED |

## 2. Dynamic Test Execution Inputs (Per-Test)

| Input ID | Name | Definition | Unit | Conceptual Data Type | Required | Source | Role in Algorithm | Validation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **INP-LOAD** | Nominal Load ($L$) | The known weight placed on the receptor | g / kg | Arbitrary Precision Numeric | YES | OIML R76-1, A.4.4.3 | Basis for determining true error | VERIFIED |
| **INP-DIR** | Loading Direction | Whether load is added or removed | N/A | Enum (UP/DOWN) | YES (Weighing Test) | OIML R76-1, A.4.4.1 | Sorts observation traces | PARTIALLY VERIFIED (Depending on UI sequence) |
| **INP-POS** | Load Position | Where the eccentric load is placed | N/A | Enum (Center, FL, FR, BL, BR) | YES (Eccentricity) | OIML R76-1, A.4.7 | Categorizes local failures in rules engine | VERIFIED |

*Note: Data types are defined conceptually to mandate arbitrary precision logic in future architectural mappings. Floating points are explicitly forbidden.*
