# NAWI Compliance System Threat Model
Date: 2026-09-25

## 1. Trust Boundaries
*   **External Users (Technicians, Reviewers, Administrators):** Untrusted entities providing input through the REST API.
*   **Web API (Express routing):** Entry point enforcing authentication (JWT) and validation.
*   **Application Services:** Business logic executing core OIML methodologies. Assumes input is sanitized by routing layer.
*   **Data Store (JsonStore):** Stores all records in `data/` folder. Trusted internal entity.

## 2. Threat Actors
*   **Malicious Insider (Technician):** Attempts to manipulate test cases they don't own, circumvent approval processes, or write falsified compliance records.
*   **Malicious Insider (Reviewer):** Attempts to view arbitrary data, alter test inputs indirectly, or self-approve.
*   **External Attacker (Unauthenticated):** Attempts to access endpoints without valid JWT, forge JWTs, or inject payloads.

## 3. STRIDE Analysis

### Spoofing
*   **Threat:** Forged JWT tokens or bypassing authentication entirely.
*   **Mitigation:** `authResolver.ts` enforces `jwt.verify` securely against a robust `jwtSecret`. 

### Tampering
*   **Threat:** A Technician modifies parameters of an `APPROVED` test case.
*   **Threat:** Direct variable injection via unvalidated `express-validator` bodies.
*   **Mitigation:** State-machine lockdowns and enforcing `validationResult` evaluations (Identified as missing!). 

### Repudiation
*   **Threat:** A Reviewer approves a test but claims they didn't.
*   **Mitigation:** `AuditService` records action immutably. Trace files are generated on artifact outputs. 

### Information Disclosure
*   **Threat:** Accessing drafts of other users.
*   **Mitigation:** Object-Level Role-Based Access Control logic (Identified as lacking in `/test-cases`!).

### Denial of Service
*   **Threat:** Submitting ultra-large files as `fileData` in Evidence.
*   **Mitigation:** Enforcing total body size limits and express-validator string bounds. 

### Elevation of Privilege
*   **Threat:** A Technician tries to `/approve` a test.
*   **Mitigation:** Route middlewares strictly enforce `requireRole(['Reviewer', 'Administrator'])`. 

## 4. Key Security Assumptions
*   OIML R 76 Math logic is pure and completely disconnected from request manipulation.
*   JSON storage acts safely against simple objects but might be vulnerable to Prototype Pollution or NoSQL-like injection if traversal exists.
