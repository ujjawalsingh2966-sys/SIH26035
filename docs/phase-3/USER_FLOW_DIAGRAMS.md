# User Flow Diagrams

## 1. Primary Technician Creation Flow

```text
[Start: Dashboard]
       │
       ▼
(Create New Compliance Check)
       │
       ▼
[Classification Gate]
       │
  (Check Scope) ───▶ [AWI / Unsupported] ──▶ (BLOCKED STATE / ABORT)
       │
       ▼
[Applicable Classification]
       │
       ▼
[Instrument Limits Setup]
(Max, Min, e, d, Zero)
       │
       ▼
[Test Applicability Matrix UI]
(Dynamic population of required modules e.g. Weighing, Eccentricity)
       │
       ▼
[Observation Entry Workspace]
       │
   (Iteration per load loop) ◀──┐
       │                        │
       ▼                        │
[Save Draft] ───────────────────┘
       │
       ▼
(Validate Math boundaries)
       │
       ▼
[Submit for Review] ──▶ [Queue routing]
```

## 2. Review & Correction Cycle

```text
[Review Queue Dashboard]
       │
       ▼
[Open Test Package]
       │
       ▼
[Analyze Explanability Trace Outputs]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
(All valid limits)                 (Bad statutory values)
       │                                 │
       ▼                                 ▼
[Approve & Seal]                 [Click Return for Correction]
       │                                 │
       ▼                                 ▼
[Generate Official Report PDF]   [Input Mandatory Rejection Notes]
       │                                 │
       ▼                                 ▼
(Archived)                       (Funnels back to Technician Dashboard)
```
