# Phase 14 - Troubleshooting Guide

## Common Issues & Remediation

### 1. Authentication / 401 Unauthorized
- **Cause**: Missing, expired, or improperly signed JWT token.
- **Remedy**: Re-authenticate and verify that `JWT_SECRET` matches across services.

### 2. IDOR / 403 Forbidden on Update
- **Cause**: Technician attempting to edit test records assigned to a different user.
- **Remedy**: Verify assignment in the test case record or reassign via Administrator.

### 3. Report Generation Blocked
- **Cause**: Test case has not reached the `APPROVED` workflow state.
- **Remedy**: Complete the review workflow cycle before requesting final compliance certificates.
