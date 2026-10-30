# SIH Evaluator Demo Access

## Scope
The evaluator landing page at `/` creates temporary, independent demo workspaces with three real staff accounts: Technician, Reviewer and Administrator. Passwords are generated securely on the backend, hashed with existing scrypt authentication, and returned only when created. Demo tokens are JWTs, signed using the existing server secret, and carry a verified workspace scope.

**This is a prototype demonstration, not a government compliance certification environment.**

## Enable for local verification
Set `EVALUATOR_DEMO_ENABLED=true` in the backend environment. Use a persistent `DATA_DIR` separate from important production data. Make sure `CLIENT_URL` includes the deployed landing-page frontend origin. The feature is **disabled by default**. Do not enable on public Render until testing and security review complete.

1. Open `/` and select Evaluator Demo Access.
2. Generate Demo Credentials. Save the three one-time passwords.
3. Sign in as Technician and inspect the seeded DRAFT/TESTING cases.
4. Sign in as Reviewer to examine READY_FOR_REVIEW cases and request correction.
5. Sign in as Administrator to explore staff administration and approved test reports.
6. Use Switch Demo Role in the dashboard to return to the credential panel.

## Isolation
Every generated workspace is a UUID folder under `DATA_DIR/evaluator-demo/<uuid>/`. The account store and all domain JSON stores resolve their path from a server-authenticated async request context. Ordinary accounts continue using original files at `DATA_DIR`. No user-supplied header can select a demo scope. The demo workspace metadata expires in 24 hours and every request validates expiry. Expired workspaces are cleaned up during provisioning.

The prototype rate limiter is per-process only. Capacity is limited to 100 active demo workspaces and generation to 3 requests/15 minutes/IP/process. Scaling across multiple Render instances requires a shared rate limiter and shared datastore. The existing application still stores tokens in localStorage; production-grade security should replace this with secure HttpOnly cookies and anti-CSRF protections.

## Constraints
- Expiration enforcement is immediate on requests but disk cleanup is opportunistic on subsequent provisioning.
- The same evaluator workspace can be used across all three roles; other workspaces cannot read or update it.
- Sample reports are **prototypes only**. They do not demonstrate complete statutory OIML compliance.
- The existing backend currently permits Reviewer **or** Administrator approval, subject to reviewer assignment. That pre-existing workflow is preserved here pending a separate reviewed RBAC change.
- Seeded sample data contains 5 cases (draft, testing, ready, returned and approved) generated using the app's existing evaluation/workflow services.
- There is no published deployment by this branch until approved, merged, and redeployed.

## Validation
Run from repository root:
```sh
npm ci
npm run build --workspace backend
npm test --workspace backend -- --runInBand
npm run build --workspace frontend
```

CI, browser testing, and deployed environment verification must be completed before public demo launch.
