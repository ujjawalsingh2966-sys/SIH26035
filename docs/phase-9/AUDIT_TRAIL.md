# Phase 9: Audit Trail Implementations

## 1. Overview
Traceability acts as the bedrock of laboratory regulatory software compliance (e.g. FDA 21 CFR Part 11, ISO 17025). The application captures an immutable event log spanning every action causing state disruption across the platform.

## 2. Standardized Audit Payload
Stored via `audit.json` in the central persistence layer.

```typescript
export interface AuditRecord {
  id: string;             // Globally unique identifier
  testCaseId: string;     // The targeted entity
  actorId: string;        // ID of the user performing the action
  actorRole: string;      // Role (Technician, Reviewer, Administrator)
  action: string;         // Nominal operation identifier (e.g. SUBMIT_FOR_REVIEW)
  previousState?: string; // Pre-operation status tag
  newState?: string;      // Post-operation status tag
  timestamp: string;      // ISO 8601 Datetime stamp
  metadata?: Record<string, any>; // Extensible metadata (reasons, context)
}
```

## 3. Querying
Authorized actors access a scoped, chronological projection of events per-testcase.

```http
GET /api/test-cases/:id/audit
```

The `AuditService.getHistoryForTest(testCaseId)` queries `auditStore` strictly matching constraints and ordering results temporarily for deterministic ledger retrieval.
