# Phase 14 - Release Candidate Rollback Plan

## Procedure
1. **Service Stop**: Halt running Node.js process (`pm2 stop nawi-service` or systemd equivalent).
2. **Binary Rollback**: Check out previous verified stable git tag or redeploy previous container artifact.
3. **Data Compatibility**: Verify JSON data store backward schema compatibility.
4. **Service Restart & Health Check**: Start the service and execute `tests/security.test.ts` and health checks.
