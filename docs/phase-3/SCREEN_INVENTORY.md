# Screen Inventory

| Screen ID | Name | Purpose | Primary User | Entry Point | Exit Destinations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UX-001** | Login | Application Access | All | Root URL | Dashboard |
| **UX-002** | Dashboard | Work Queue Summary | All | Login | Test List, Review Workspace |
| **UX-003** | Test List | Filterable list of all tests | All | Navigation | Test Details |
| **UX-004** | Instrument Classification | Determines scope applicability (NAWI / Single Range) | Technician | Create Test | Test Configuration or Blocked State |
| **UX-005** | Config & Limits Entry | Capture $Max$, $Min$, $e$, $d$ | Technician | Classification | Test Selection Matrix |
| **UX-006** | Test Selection Matrix | Displays Applicable tests based on Accuracy Class | Technician | Config Entry | Observation Workspace |
| **UX-007** | Observation Workspace | Physical Data Entry ($I, \Delta L, E_0$) | Technician | Selection Matrix | Validation / Drafts |
| **UX-008** | Validation Summary | Pre-submission explicit calculation review ($P, E_c$) | Technician | Observation | Submit / Return to Edit |
| **UX-009** | Reviewer Workspace | Read-only inspection of formulas, evidence, metrics | Reviewer | Queue | Approve / Request Correction |
| **UX-010** | Correction Request | Annotation of rejected tests to send back | Reviewer | Reviewer WS | Review Queue |
| **UX-011** | Retest Dashboard | Specific UX pointing out correction metrics | Technician | Dashboard | Observation Workspace |
| **UX-012** | Official Report Preview | Read-only artifact layout display | Both | Approval | Print / History |
| **UX-013** | Unsupported Instrument Block | Hard dead-end preventing execution of AWI/Multi-range | Technician | Classification | Dashboard |
| **UX-014** | Error & Audit View | Trace lookup mapping versioning to math | Auditor | Test List | Test List |
