# Information Architecture

The application structure organizes workflows matching the statutory testing phases derived from Phase 1 and Phase 2.

```text
Login (Authentication)
│
├── Dashboard (Role-specific Queue)
│
├── Test Cases (Core Workflow)
│    ├── Intake / Draft (Classification & Scope Validation)
│    ├── Testing Workspace (Observation Entry per Test Type)
│    ├── Validation Review (Pre-submission Error Auditing)
│    ├── Review Queue (Approver Check)
│    ├── Returned for Correction (Rework State)
│    ├── Approved
│    └── Archival & Read-Only Traces
│
├── Instruments & Manufacturers (Meta-Data Registers)
│    ├── Scope Matrices
│    └── Specifications Tracker
│
├── Compliance Reports
│    ├── Preview
│    ├── Official History
│    └── Document Repository
│
├── Global Search & Audit History
│
└── System Administration (Configuration & Rule Versions)
```

## Section Purposes

*   **Dashboard**: The operational entry point summarizing "What needs my attention?". Splits automatically between Technician drafts and Reviewer queues.
*   **Test Cases**: The primary pipeline routing the instrument from identification (e.g. `INST-E-SR-I`) through specific observation arrays (`TEST-WEIGH`, `TEST-ECC`) ensuring MPE compliance math.
*   **Instruments**: Reference boundaries locking hardware metadata ($Min$, $Max$, $e$, $d$) against future test permutations.
*   **Reports**: Statutory PDF mappings of approved test evaluations.
