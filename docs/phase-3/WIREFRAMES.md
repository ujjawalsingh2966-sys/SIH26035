# Conceptual Wireframes

The following ASCII layouts represent conceptual UX layouts isolating purely the core separation of realities required for compliance clarity.

## UX-002 Dashboard (Technician)

```text
+-------------------------------------------------------------+
| [LOGO] NAWI Evaluator               Welcome, Tech-A  [Exit] |
+-------------------------------------------------------------+
|  Active Drafts            |  Returned For Modifications     |
|                           |                                 |
|  * TEST-442 (Brand A)     |   * TEST-199 (Max Limit Error)  |
|    - Pending Setup        |      <Reviewer notes visible>   |
|                           |                                 |
|  * TEST-429 (Mettler)     |                                 |
|    - 80% Complete         |                                 |
|                           |                                 |
|  [ + Start New NAWI Compliance Check ]                      |
+-------------------------------------------------------------+
```

## UX-004 Classification Constraints Block

```text
+-------------------------------------------------------------+
| Instrument Classification Gateway                           |
+-------------------------------------------------------------+
|  [Select Scale Operational Topology]                        |
|                                                             |
|   (o) Single Range / Fixed                                  |
|   ( ) Multi-Interval (Deferred: BLOCKED)                    |
|   ( ) Continuous Dynamic AWI (Deferred: BLOCKED)            |
|                                                             |
|   Note: Statutory rules mandate explicit engine limitations |
|                                                             |
|  [ PROCEED TO METADATA ]     [ CANCEL ]                     |
+-------------------------------------------------------------+
```

## UX-007 Observation Split Entry (The Workspace)

```text
+-------------------------------------------------------------------------+
| Test Module: Weighing Performance        Class: III  | Max: 5kg | e: 5g |
+-------------------------------------------------------------------------+
|                                                                         |
|  +---------------------------+   +-----------------------------------+  |
|  | RAW OBSERVATIONS (Inputs) |   | SYSTEM VERIFICATION (Read-Only)   |  |
|  | Load L | Ind I | Add DL   |   | True(P) | Err(Ec) | Lim | Result  |  |
|  |--------|-------|----------|   |---------|---------|-----|---------|  |
|  | [10]kg | [10]kg| [  0]kg  |-->|  10.0kg | +0.0kg  | 10g | [PASS]  |  |
|  | [15]kg |[16]kg | [0.5]kg  |-->|  15.5kg | +0.5kg  | 15g | [FAIL]! |  |
|  +---------------------------+   +-----------------------------------+  |
|                                                                         |
|  [ Save Changes & Return ]       [ Verify and Submit to Review ]        |
+-------------------------------------------------------------------------+
```

## UX-009 Reviewer Explanation Hover

```text
+-------------------------------------------------------------+
| Evaluated Result: FAIL                                      |
|                                                             |
|   Hover -> [ Trace Explainability Details ]                 |
|            - Algorithm: OIML R76-1:2006 CORE V1.0           |
|            - Target m: m = L/e = 3000                       |
|            - Max Bound applied: 1.5e (7.5g)                 |
|            - Input math: Ec = +10g                          |
|            - Resolution: Absolute(10) > 7.5 -> FALSE        |
|                                                             |
| [ APPROVE ]   [ RETURN TO TECHNICIAN WITH NOTES ]           |
+-------------------------------------------------------------+
```
