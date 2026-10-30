import { Router } from "express";
import jwt from "jsonwebtoken";
import { body } from "express-validator";
import { config } from "../config/env";
import { validateRequest } from "../middlewares/validateRequest";
import { accountStore, checkPassword, publicAccount } from "../services/AccountService";
import { withinDemoWorkspace } from "../services/demoScope";
import { evaluatorDemoEnabled, provisionEvaluatorWorkspace, workspaceFromDemoEmail, workspaceMetadata } from "../services/EvaluatorDemoService";

export const evaluatorDemoRoutes = Router();
const attempts = new Map<string, { count: number; until: number }>();
evaluatorDemoRoutes.use((_req, res, next) => {
  if (!evaluatorDemoEnabled()) return res.status(404).json({ success: false, error: "Evaluator demo is unavailable" });
  next();
});
evaluatorDemoRoutes.use((req, res, next) => {
  const now = Date.now();
  for (const [key, val] of attempts) if (val.until < now) attempts.delete(key);
  const key = `${req.ip || "unknown"}:${req.path}`;
  let val = attempts.get(key);
  if (!val) { val = { count: 0, until: now + 15 * 60000 }; attempts.set(key, val); }
  val.count++;
  if (val.count > (req.path === "/generate" ? 3 : 30)) {
    return res.status(429).json({ success: false, error: "Too many demo requests. Retry later." });
  }
  next();
});
evaluatorDemoRoutes.post("/generate", (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.status(201).json({ success: true, data: provisionEvaluatorWorkspace() });
  } catch (error) {
    return res.status(503).json({ success: false, error: error instanceof Error ? error.message : "Demo generation failed" });
  }
});
evaluatorDemoRoutes.post("/login",
  body("email").isEmail().isLength({ max: 254 }),
  body("password").isString().isLength({ min: 1, max: 128 }),
  validateRequest,
  (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const id = workspaceFromDemoEmail(email);
    if (!id || !workspaceMetadata(id)) return res.status(401).json({ success: false, code: "DEMO_EXPIRED", error: "Invalid or expired demo credentials" });
    return withinDemoWorkspace(id, () => {
      const account = accountStore.findAll().find((a) => a.email === email);
      if (!account || !account.active || !checkPassword(req.body.password, account.passwordHash)) {
        return res.status(401).json({ success: false, error: "Invalid or expired demo credentials" });
      }
      const meta = workspaceMetadata(id);
      if (!meta) return res.status(401).json({ success: false, code: "DEMO_EXPIRED", error: "Demo expired" });
      const remainingSeconds = Math.ceil((Date.parse(meta.expiresAt) - Date.now()) / 1000);
      if (remainingSeconds <= 0) return res.status(401).json({ success: false, code: "DEMO_EXPIRED", error: "Demo expired" });
      const token = jwt.sign({ id: account.id, email: account.email, role: account.role, demoWorkspaceId: id },
        config.jwtSecret, { algorithm: "HS256", expiresIn: Math.min(remainingSeconds, 8 * 3600) });
      res.setHeader("Cache-Control", "no-store");
      return res.json({ success: true, data: { token, user: publicAccount(account), workspaceId: id, expiresAt: meta.expiresAt, serverNow: new Date().toISOString() } });
    });
  },
);
