# Native programme API — P3 and partial P4A

Current handoff: [P4A is incomplete and verification is blocked](P4A_METROLOGICAL_PERFORMANCE.md). This contract documents local source, not verified production readiness.

All `/api/v1/native/:id` operations use existing authenticated staff access and case authorization. Only the owning Technician in DRAFT/TESTING may declare a programme; only TESTING accepts observations. Reviewer/Administrator read/review policy is unchanged. Business has no access. Mutations require current `expectedRevision`; stale/overlapping requests receive 409.

`GET /api/v1/native/:id` returns `{ testCase, programme, tests, assessment }`. Invalid persisted history is not rewritten: `programme:null`, `programmeError`, INCOMPLETE/UNDETERMINED assessment and preserved raw case/tests remain available to authorized staff.

`PUT /api/v1/native/:id/programme` accepts `{ expectedRevision, profile, performance? }` only. The P3 profile contract/strict primitive enums remain unchanged. Omitting `performance` creates the existing P3 ruleset. Supplying its complete explicit characteristic object creates `W8LAB-R76-2006-P4A-1`. Null means unknown. Read the TypeScript `PerformanceProfile` contract and phase report for fields/limits. Manufacturer/instrument specifications still come from the frozen server-owned case snapshot, never request-supplied replacement values.

Performance fields: `selfIndicating`, ordered `devices` (DISPLAY/PRINT), `tareKind`, `maximumTareG`, `tareWeighingDevice`, `combinedZeroTare`, `mobile`, `adjacentSupports`, `rollingSections`, `rollingReverse`, `rollingLoadG`, `initialZeroRangeG`, `stabilityFunctions`, `stabilityDocumentation`, `stabilityWorstCase`, `stabilityLoadsG`. Tare absence must agree with the frozen instrument; printer and PRINT-function inventories cannot contradict. Unknown/unsupported configuration blocks corresponding procedures.

Programme replacement is allowed only before native evidence. Existing P4A declarations cannot downgrade to P3. All versions retain their original canonical decisions/fingerprints; historical observations do not become newly evaluated evidence.

`PUT /api/v1/native/:id/tests/:procedure/:series` accepts `{ expectedRevision, submission }`. Submission requires matching primitive procedure/series, actual readings, explicit conditions and evidence reference. Privileged/unknown fields are rejected. Server decisions govern allowed series; callers cannot supply their own limits, result, applicability, owner or reviewer. Stable IDs make a series correction replace its current record while audit metadata retains the previous input/result. Current JSON storage is not a cross-collection transaction system.

P4A readings have core `sequence,load,indication,additionalWeights,unit` and only procedure-specific additional fields. Weighing uses ordered UP/DOWN phases; tare records actual tare; eccentricity requires planned position/fresh zero; time tests require actual timezone timestamps/temperature and preserved order; equilibrium records actual disturbed/inhibited outcomes and following indications. All quantities are decimal strings. Observation units mg/g/kg/t are normalized independently of instrument e stored in grams. Entry plans are nominal targets, not observations.

Responses: 400 invalid input/sequence/units; 401 unauthenticated; 403 unauthorized owner/role/state; 409 stale/frozen/invalid history; 422 unsupported/undetermined/N/A evaluation. Valid partial observations may return 200 with INCOMPLETE; a completed valid failure returns FAIL. A 200 response is not evidence of complete instrument compliance.

Client behavior: retain input after confirmed validation rejection and allow retry; synchronous pending guard prevents overlap. Unknown delivery does not auto-resend—reload and inspect saved records/revision. Reports retain their existing approved-state authorization. Overall PASS/FINAL stays blocked by any missing, unsupported or undetermined applicable programme requirement.
