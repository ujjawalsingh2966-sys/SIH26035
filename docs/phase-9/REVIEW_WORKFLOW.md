# Phase 9: Review Workflow

## 1. Introduction
The NAWI verification framework incorporates a strict review and approval lifecycle. All test cases must undergo independent verification before attaining an `APPROVED` status. This document describes the core review workflow.

## 2. Segregation of Duties
To preserve integrity and comply with common laboratory metrological standards, the platform strictly segregates execution from approval:
- **Technicians** create tests, capture observations, and submit records for review.
- **Reviewers** or **Administrators** evaluate the data, returning it for correction or providing final approval.
- **Self-Approval Guard**: A Reviewer/Administrator heavily involved in test creation cannot authorize the test as an approver. The system explicitly blocks a user from reviewing a test case where `technicianId` matches their own user ID.

## 3. Workflow Stages
- **DRAFT**: Test case initiated. Instrument parameters defined.
- **TESTING**: Environmental conditions set. Observations are captured and calculation/compliance engines trigger.
- **READY_FOR_REVIEW**: The Technician indicates the test is complete and ready for independent verification.
- **UNDER_REVIEW**: A designated Reviewer claims the test and evaluates the inputs, observations, and engine compliance verdicts.
- **RETURNED_FOR_CORRECTION**: Flaws or discrepancies identified by the reviewer. The test returns to the technician queue.
- **APPROVED**: Finalized test case. Result is sealed and observation modifications are permanently blocked.

## 4. API Usage
```http
POST /api/test-cases/:id/workflow/submit
Authorization: Bearer <technician-token>

POST /api/test-cases/:id/workflow/start-review
Authorization: Bearer <reviewer-token>

POST /api/test-cases/:id/workflow/approve
Authorization: Bearer <reviewer-token>

POST /api/test-cases/:id/workflow/return
Authorization: Bearer <reviewer-token>
Content-Type: application/json
{
  "reason": "Missing environmental temp observations."
}
```
