import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { accountStore } from "../services/AccountService";
import { runInDemoScope } from "../services/DemoScope";
import { verifyDemoToken, isDemoAccessEnabled } from "../services/DemoService";
import { logger } from "../utils/logger";

// Type extension for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string; demo?: boolean; demoId?: string; demoExpiresAt?: string };
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({
        success: false,
        error: "Unauthorized: Missing or invalid token",
      });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
    }) as { id: string; role: string; email: string; demo?: boolean; demoId?: string };
    if (decoded.demo === true) {
      if (!isDemoAccessEnabled()) return res.status(401).json({ success: false, error: "Evaluator demo access is disabled." });
      const verified = verifyDemoToken(token);
      if (!verified) {
        return res.status(401).json({ success: false, error: "Demo access has expired. Generate a new demo ID." });
      }
      return runInDemoScope(verified.session.id, () => {
        const account = accountStore.findById(decoded.id);
        if (!account || !account.active || account.role !== verified.role) {
          return res.status(401).json({ success: false, error: "Demo account is unavailable." });
        }
        req.user = { id: account.id, email: account.email, role: account.role,
          demo: true, demoId: verified.session.id, demoExpiresAt: verified.session.expiresAt };
        next();
      });
    }
    // Prevent demo-claim-bearing tokens from falling back to real account authentication.
    if (decoded.demoId) return res.status(401).json({ success: false, error: "Invalid session" });
    const account = accountStore.findById(decoded.id);
    if (!account || !account.active || account.role !== decoded.role) {
      return res
        .status(401)
        .json({
          success: false,
          error: "Account is unavailable. Please sign in again.",
        });
    }
    req.user = { id: account.id, email: account.email, role: account.role };
    next();
  } catch (err) {
    logger.warn("Failed authentication attempt: Invalid token");
    return res
      .status(401)
      .json({ success: false, error: "Unauthorized: Invalid token" });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Authorization blocked: User ${req.user.id} with role ${req.user.role} attempted to access restricted route`,
      );
      return res
        .status(403)
        .json({ success: false, error: "Forbidden: Insufficient permissions" });
    }
    next();
  };
};
