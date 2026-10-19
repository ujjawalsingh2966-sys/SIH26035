# W8LAB manufacturer and instrument API (P2)

Current implementation, 18 October 2026. All paths are relative to `/api/v1` and require a valid active staff session. Business/Applicant access is prohibited. Authentication, case ownership, reviewer assignment and report permissions remain governed by P1 and [laboratory workflow policy](LABORATORY_REVIEW_WORKFLOW.md).

## Endpoints and permissions

| Method/path | Permission / behavior |
| --- | --- |
| `GET /manufacturers?q=&includeArchived=true` | All laboratory staff; search name, identifier, address; active records by default |
| `GET /manufacturers/:id` | All laboratory staff; includes revision, creator and change history |
| `POST /manufacturers` | Technician or Administrator |
| `PUT /manufacturers/:id` | Creating Technician or Administrator; full replacement of editable fields and `expectedRevision` |
| `DELETE /manufacturers/:id` | Same edit permission; `expectedRevision`; soft archive only if no instrument refers to it; never deletes records |
| `GET /instruments?q=&manufacturerId=` | Shared staff catalog; search name/model/serial/manufacturer name |
| `GET /instruments/:id` | `{ instrument, manufacturer, evaluationSupport: { supported, reasons }, linked }` |
| `GET /instruments/:id/history` | Only cases permitted by existing owner/review policy; inaccessible IDs are omitted |
| `POST /instruments` | Technician only, preserving original creation policy |
| `PUT /instruments/:id` | Creating Technician or Administrator, only before ANY linked case exists; full declared registration and `expectedRevision` |
| `POST /test-cases` | Technician only; requires a valid supported saved instrument; freezes server-owned metadata |

The application has no instrument delete API. Manufacturer archive retains its ID, history and duplicate-identity reservation. It cannot archive linked manufacturers or reactivate archived records through an ordinary edit. Stale updates and repeated archives return 409. No request may set creator, ID, role, timestamps, history, canonical values or snapshot content on master records.

## Manufacturer payload

Required strings: `name` (160 chars), `identifier` (100), `address` (600). Blank/control-character values are rejected; whitespace is normalized. Identifier must be unique case-insensitively; name+address is also unique after case/whitespace normalization, including archived records. This is an application duplicate policy, not a statutory identity-verification claim.

Updates add integer `expectedRevision`. Linked manufacturer identifiers cannot change. Name/address changes are allowed only if all linked cases already have frozen snapshots. Legacy references without snapshots block edits instead of being silently rewritten/migrated. Manufacturer history records actor, time, action and prior editable values.

## Instrument payload

Required strings: `manufacturerId`, `name`, `model`, `serialNumber`, `accuracyClass`, `maxCapacity`, `minCapacity`, `e`, `d`, `weighingUnit`. The manufacturer must exist and be active. Serial identity is unique within a manufacturer after case/whitespace normalization.

Explicit booleans: `isWeighing`, `isManual`, `isElectronic`, `isSingleRange`, `hasTare`, `hasAuxiliaryIndication`, `isGrading`, `softwareControlled`. The first four must be true in the currently implemented registration profile. No missing technical flag is silently inferred by the API.

Capacities and intervals are positive decimal **strings**, at most 40 characters, with no exponent/hex notation. Units: `mg`, `g`, `kg`, `t`. Supported classes: `I`, `II`, `III`, `IIII`. Values are normalized using decimal arithmetic to canonical grams, retaining the original strings/unit in `declaredSpecifications`. `n` is derived exactly as Max/e; if a caller supplies it, it must be an integer string matching that result. Validation covers interval steps, class-dependent n/Min bounds and supported e/d/auxiliary relationships, not a complete conformity assessment. See [P2 validation scope and primary sources](P2_MANUFACTURER_INSTRUMENT_MANAGEMENT.md).

Optional strings: `softwareIdentification` (160; required when softwareControlled), `typeApprovalMark` (160; declared, not verified), `technicalNotes` (1000). A software ID contradicting `softwareControlled: false` is rejected. Empty optional values remain unrecorded, not invented.

Automatic, mechanical, non-weighing and multi-range/multi-interval configurations return 422 without saving. Metadata-valid Class I, auxiliary-device and tariff/toll-grading profiles can be registered but are explicitly **not supported for evaluation**. Attempting a case for them returns 409. Specialist sub-milligram exceptions and other undeclared profiles are deferred, not certified.

Legacy instruments remain readable. A new case requires the validated declared specification record and canonical consistency. Linked legacy instruments cannot be edited in place; create a new validated registration with a genuinely distinct identification, or resolve the legacy record through a separately approved migration/revision policy. Do not falsify serial numbers to work around this protection.

## Responses, delivery and traceability

Success envelope: `{ success: true, data }`; creation 201, reads/updates/archive 200. Errors: 400 invalid/privileged fields, 401 invalid session, 403 prohibited role/creator, 404 absent record, 409 duplicate/revision/linked protection/unsupported case, 422 unsupported registration configuration, 503 persistence failure. Master writes use atomic JSON replacement with in-memory rollback; still one backend writer per data directory.

Forms preserve values on confirmed rejection and permit correction/retry. Synchronous guards prevent overlapping submissions. A confirmed instrument save is reused when its subsequent case request is rejected. Network loss, unreadable responses or ambiguous server errors stop resubmission and direct the operator to check saved records. There is no general POST idempotency protocol; separate legitimate cases for an instrument remain possible.

New cases contain `masterDataSnapshot` version `W8LAB-MASTER-1`, capture timestamp, instrument and manufacturer. The backend ignores client-supplied snapshot content and supplies its own. Evaluation, completeness assessment, repository detail and reports resolve this snapshot. The `metadataSource` response/report field distinguishes `SNAPSHOT` from `LEGACY_LIVE_REFERENCE`. Historical files/evaluations are never backfilled. Current directory information may differ from a case's intentionally frozen metadata.
