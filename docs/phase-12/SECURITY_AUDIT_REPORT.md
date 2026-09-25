# Security Audit Report
Date: 2026-09-25

## Executive Summary
A comprehensive security review of the NAWI Compliance application identified several critical vulnerabilities primarily revolving around missing input validation enforcement, Object-Level Authorization (IDOR) gaps, and file upload safety. 

## Identified Vulnerabilities

### 1. Missing Validation Enforcement (CRITICAL)
**Location:** All routes utilizing `express-validator` (e.g., `evidenceRoutes.ts`, `instrumentRoutes.ts`).
**Description:** While `body()` rules are configured, `validationResult(req)` is never checked. Consequently, invalid inputs (HTML tags for XSS, massive payloads, mismatched types) bypass the router mapping entirely and enter the Service/Store boundaries.
**Remediation:** Implement a shared `validateRequest` middleware that throws 400 on `!validationResult(req).isEmpty()`.

### 2. Insecure Object-Level Authorization / IDOR (HIGH)
**Location:** `testCaseRoutes.ts`, `evidenceRoutes.ts`.
**Description:** A Technician can mutate test cases belonging to other Technicians via `PUT /test-cases/:id/laboratory-conditions` and `PUT /test-cases/:id/status`. Furthermore, `GET /test-cases/` returns all test cases indiscriminately.
**Remediation:** Filter `testCaseStore.findAll()` by user scope if the user is a Technician. Enforce `if (testCase.technicianId !== req.user.id)` inside endpoints.

### 3. Missing Output Encoding (HIGH)
**Location:** `SimplePdfGenerator.ts` and `HtmlGenerator.ts`.
**Description:** If malicious users inject `<script>` tags into `Instrument.name` or `Evidence.description`, the HTML generator blindly renders it, causing XSS upon PDF conversion or direct HTML rendering.
**Remediation:** Escape HTML entities for user-controlled strings during artifact generation.

### 4. Hardcoded Development Credentials (MEDIUM)
**Location:** `auth.routes.ts`.
**Description:** The login endpoint accepts `dev-demo-password` for authenticating anyone.
**Remediation:** Remove it, or ensure it's restricted for non-prod environments only. 

### 5. Path Traversal & File Uploads (MEDIUM)
**Location:** `evidenceRoutes.ts`.
**Description:** Raw `fileData` (base64) is currently stored in RAM/JSON. Ensure robust `sizeBytes` verification occurs. 
**Remediation:** Enforce payload size limits in express.

## Status: PENDING REMEDIATION
