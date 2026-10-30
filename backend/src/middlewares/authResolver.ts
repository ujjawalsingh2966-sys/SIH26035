import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { accountStore } from "../services/AccountService";
import { currentDemoWorkspace, withinDemoWorkspace } from "../services/demoScope";
import { evaluatorDemoEnabled, workspaceMetadata } from "../services/EvaluatorDemoService";
import { logger } from "../utils/logger";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string; demoWorkspaceId?: string };
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized: Missing or invalid token" });
  }
  try {
    const decoded = jwt.verify(authHeader.slice(7), config.jwtSecret, { algorithms: ["HS256"] }) as {
      id: string; role: string; email: string; demoWorkspaceId?: string;
    };
    const workspaceId = decoded.demoWorkspaceId;
    if (workspaceId && (!evaluatorDemoEnabled() || !workspaceMetadata(workspaceId))) {
      return res.status(401).json({ success: false, code: "DEMO_EXPIRED", error: "Demo session expired or unavailable" });
    }
    // A production request must not inherit another request's demo scope.
    const resolve = () => {
      const account = accountStore.findById(decoded.id);
      if (!account || !account.active || account.role !== decoded.role ||
          account.email !== decoded.email || (!!workspaceId !== !!currentDemoWorkspace())) {
        return res.status(401).json({ success: false, error: "Account is unavailable. Please sign in again." });
      }
      // Block regular tokens from impersonating demo-scoped accounts.
      if (!workspaceId && account.email.endsWith("@demo.w8lab.test")) {
        return res.status(401).json({ success: false, error: "Invalid session scope" });
      }
      if (workspaceId) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Demo-Expires-At", workspaceMetadata(workspaceId)!.expiresAt);
        res.setHeader("X-Demo-Server-Now", new Date().toISOString());
        res.setHeader("Access-Control-Expose-Headers", "X-Demo-Expires-At, X-Demo-Server-Now");
      }
      req.user = { id: account.id, email: account.email, role: account.role, ...(workspaceId ? { demoWorkspaceId: workspaceId } : {}) };
      next();
    };
    return workspaceId ? withinDemoWorkspace(workspaceId, resolve) : resolve();
  } catch {
    // A correctly signed token may have expired at exactly the same instant
    // as its workspace. Report DEMO_EXPIRED without trusting an unsigned JWT.
    try {
      const signed = jwt.verify(authHeader.slice(7), config.jwtSecret, {
        algorithms: ["HS256"], ignoreExpiration: true,
      }) as { demoWorkspaceId?: string };
      if (signed.demoWorkspaceId && !workspaceMetadata(signed.demoWorkspaceId)) {
        return res.status(401).json({ success: false, code: "DEMO_EXPIRED", error: "Demo session expired" });
      }
    } catch { /* Invalid signatures retain generic Unauthorized response. */ }
    logger.warn("Failed authentication attempt: Invalid token");
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid token" });
  }
};

export const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, error: "Unauthorized" });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: "Forbidden: Insufficient permissions" });
  }
  next();
};
