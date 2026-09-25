# Phase 9: Record Locking Mechanisms

## 1. Overview
Guarding the data bounds after verification initiation represents a fundamental aspect of digital integrity against tamperings. An active record locking mechanism blocks REST mutative events on artifacts traversing formal verification pipelines.

## 2. Test Case Locking
Modifications to vital structures (i.e. `laboratoryConditions`) are unconditionally rejected (`403 Forbidden`) if the root test case is tagged as:
- `READY_FOR_REVIEW`
- `UNDER_REVIEW`
- `APPROVED`

Code logic (`routes/testCaseRoutes.ts`):
```typescript
if (testCase.status === 'APPROVED' || testCase.status === 'UNDER_REVIEW' || testCase.status === 'READY_FOR_REVIEW') {
  return res.status(403).json({ success: false, error: 'Cannot modify a test case in this state' });
}
```

## 3. Observation Locking 
Appended instances of tests to the `observationStore` demand the containing `TestCase.status` equals strictly `TESTING`.

Code logic (`routes/observationRoutes.ts`):
```typescript
if (testCase.status !== 'TESTING') {
  return res.status(403).json({ success: false, error: 'Cannot modify observations unless test case is in TESTING status' });
}
```
