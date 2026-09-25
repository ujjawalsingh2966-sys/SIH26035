# Phase 9: State Transition Matrix

## 1. Overview
Test case status is centrally managed by the `WorkflowService`. Status updates are deterministically guarded, preventing accidental jumps across the review lifecycle.

## 2. Transition Matrix

| Initial State | Target State | Trigger Method | Allowed Roles | Preconditions |
| :--- | :--- | :--- | :--- | :--- |
| **DRAFT** | **TESTING** | `PUT /:id/status` (Start Testing) | Technician | None |
| **TESTING** | **READY_FOR_REVIEW** | `WorkflowService.submitForReview` | Technician | Must be the assigned `technicianId` |
| **RETURNED_FOR_CORRECTION** | **TESTING** | `PUT /:id/status` (Resume Testing)| Technician | Must be assigned `technicianId` |
| **READY_FOR_REVIEW** | **UNDER_REVIEW**| `WorkflowService.startReview` | Reviewer, Administrator | `technicianId` != `actorId` |
| **UNDER_REVIEW** | **APPROVED** | `WorkflowService.approve` | Reviewer, Administrator | `technicianId` != `actorId`, Reviewer claims record |
| **UNDER_REVIEW** | **RETURNED_FOR_CORRECTION** | `WorkflowService.returnForCorrection` | Reviewer, Administrator | `technicianId` != `actorId`, Reason must be provided |

## 3. Transition Failure Cases
The engines raise exceptions (yielding a `400 Bad Request` or `403 Forbidden`) under the following violations:
- Attempting to approve without passing `READY_FOR_REVIEW` and `UNDER_REVIEW`.
- A Technician attempting to trigger `startReview` or `approve`.
- A Reviewer attempting to review their own test case.
- Supplying invalid identifiers or transitioning from an already finalized (`APPROVED`) state.
