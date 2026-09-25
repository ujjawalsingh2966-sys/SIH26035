# Phase 9: Role-Based Access Control (RBAC) Implementation

## 1. Description
The NAWI backend employs Role-Based Access Control to enforce security and workflow integrity across all API routes.

## 2. Defined Roles
- **Technician**: Authorized to create test cases, log observations, set laboratory conditions, and perform the primary tasks required to generate metrological data.
- **Reviewer**: Authorized to read tests, start reviews, return tests for correction, and issue final approvals. Cannot conduct tests themselves.
- **Administrator**: Possesses universal privileges conceptually, but in the context of the workflow functions identically to a Reviewer to ensure proper auditing boundaries.

## 3. Middleware: `requireRole`
Implementation utilizes an Express authorization middleware (`authResolver.ts`) that asserts the incoming role attached to the authenticated session context. (In the current MVP mockup, user mapping is achieved through a controlled mock representation on `req.user`).

```typescript
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role || 'Technician';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: insufficient role' });
    }
    next();
  };
};
```

## 4. Route Guardianship
- `POST /api/test-cases`: Requires `Technician`
- `PUT /api/test-cases/:id/laboratory-conditions`: Requires `Technician`
- `POST /api/observations`: Requires `Technician`
- `POST /api/test-cases/:id/workflow/start-review`: Requires `Reviewer` or `Administrator`
- `POST /api/test-cases/:id/workflow/approve`: Requires `Reviewer` or `Administrator`
- `GET /api/test-cases/:id/audit`: Requires `Technician`, `Reviewer`, or `Administrator`
