# AUTHENTICATION FOUNDATION

## Strategy
Stateless JSON Web Tokens (JWT) passing via the `Authorization: Bearer <token>` header.

## Current Setup (Phase 4 Mock)
A mock authentication boundary is established physically protecting the backend `/api/v1/instruments` route.
The frontend pushes users to a login form that bypasses true SQL validation to instantiate UI flows in Development.

## Authorization (RBAC)
Middleware `requireRole(['RoleString'])` is bound in the backend routing level. Do not push RBAC masking solely to the React frontend layer.
