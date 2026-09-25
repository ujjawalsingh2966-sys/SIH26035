# Phase 12 - Vulnerability Remediation Log

## Overview
This log documents the specific vulnerabilities resolved and actions taken across NAWI endpoints and services during the Phase 12 security audit and hardening process.

### VULN-001: Missing Payload Validation Enforcement
- **Description**: API endpoints accepted incomplete bodies due to missing validation middleware enforcing expressive boundaries.
- **Affected Route**: `/api/v1/evidence` (and others like Manufacturer, Instrument, TestCase POST methods).
- **Remediation**: Included the `express-validator` `validateRequest` middleware sequentially after validation bodies in `evidenceRoutes.ts`, `instrumentRoutes.ts`, `manufacturerRoutes.ts`, `observationRoutes.ts`, and `testCaseRoutes.ts`.
- **Status**: **FIXED** (Verified by passing Security Test: "should reject missing fields for Evidence utilizing validateRequest").

### VULN-002: Object-Level Authorization (IDOR) on Laboratory Conditions 
- **Description**: A technician authenticated with a valid token could manipulate conditions on test cases that were assigned to different technicians.
- **Affected Route**: `PUT /api/v1/test-cases/:id/laboratory-conditions`
- **Remediation**: Intercepted the user token representation via `(req as any).user`. Added conditions logic limiting condition updates if `user.role === 'Technician'` and `testCase.technicianId !== user.id`. Identical protection added to observations submission logic and manual status state transition in `PUT /api/v1/test-cases/:id/status`.
- **Status**: **FIXED** (Verified by passing Security Test: "should FORBID Tech-2 from modifying Tech-1s Test Case (IDOR Prevention)").

### VULN-003: Improper Privilege Enforcement on Approvals
- **Description**: Endpoints triggering administrative state transitions (e.g., approval of cases) relied only on generalized authentication rather than targeted role scopes, posing an escalation risk.
- **Affected Route**: `POST /api/v1/test-cases/:id/workflow/approve`
- **Remediation**: Replaced base authentication paths with `requireRole(['Reviewer', 'Administrator'])` for endpoints governing `start-review`, `approve`, and `return` mechanisms mapped inside `testCaseRoutes.ts`.
- **Status**: **FIXED** (Verified by passing Security Test: "should FORBID Technician from approving tests").

### VULN-004: XSS Vulnerability in Generated HTML Reports
- **Description**: Artifact generation directly mapped unsanitized dynamic fields (like the instrument model text payload) into HTML nodes in generated reports.
- **Affected Component**: `HtmlGenerator.ts`
- **Remediation**: Introduced a static private function `escapeHtml()` replacing unsafe characters `&, <, >, ", '` with their HTML encoded equivalents inside `HtmlGenerator.ts`. Added instrument details to the `ReportDataset` mapped by the `ReportService.ts`. Passed `report.testCaseId`, `report.instrumentDetails.model`, and other dynamic text through `escapeHtml()` during generation. 
- **Status**: **FIXED** (Verified by passing Security Test: "should escape XSS payloads in HTML artifacts").