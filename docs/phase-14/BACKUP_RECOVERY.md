# Phase 14 - Backup and Disaster Recovery

## Storage Architecture
NAWI uses file-based persistent JSON document stores and structured evidence directories.

## Backup Procedure
1. Create periodic atomic filesystem snapshots of the `backend/data/` and `backend/uploads/` directories.
2. Archive generated compliance reports and cryptographic hash logs to secondary immutable cold storage.

## Recovery Policy Status
Operational Recovery Time Objective (RTO) and Recovery Point Objective (RPO) are defined as **TBD** pending host organization infrastructure policy confirmation.
