# Compliance Result Model

## 1. Domain Object Definitions

The core architecture limits outcomes to a strict union type definition, removing ambiguity in the downstream processing or API responses.

```typescript
export type ComplianceVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'BLOCKED';
```

## 2. Verdict Map
- **PASS:** The instrument passed the required legal limitation check for the given evaluation dimension safely (i.e. $|E_c| \le \text{MPE}$).
- **FAIL:** The dimension calculated explicitly exceeds the allowed error magnitude permitted statutorily (i.e. $|E_c| > \text{MPE}$).
- **INCONCLUSIVE:** The dimension cannot be legally evaluated due to inapplicability—such as running a specific dimensional check (Tare evaluation) on hardware known statically not to support it.
- **BLOCKED:** The evaluation data pipeline hit a complete roadblock and no legal determination was technically possible. Caused overwhelmingly by malstructured inputs, lack of calculation bounds, or unsupported instruments generating upstream errors.

## 3. Structural Object Result
The top level outcome interface couples the verdict tightly with an optional (for `PASS`/`FAIL`) tracing structure containing human-readable forensic audit information regarding the decision.

```typescript
export interface ComplianceResult {
  verdict: ComplianceVerdict;
  trace?: ComplianceTrace;
}
```
