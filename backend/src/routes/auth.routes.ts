import { Router } from "express";
import { body } from "express-validator";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { authenticate, requireRole } from "../middlewares/authResolver";
import { validateRequest } from "../middlewares/validateRequest";
import {
  accountStore,
  checkPassword,
  createAccount,
  publicAccount,
  roles,
} from "../services/AccountService";

const router = Router();
const attempts = new Map<string, { count: number; until: number }>();
// Single-process pilot limiter; use a shared limiter when deploying multiple instances.
router.use((req, res, next) => {
  if (req.method !== "POST") return next();
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.until <= now) attempts.delete(key);
  const key = req.ip || "unknown";
  const value = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  value.count++;
  attempts.set(key, value);
  if (value.count > 50)
    return res
      .status(429)
      .json({
        success: false,
        error: "Too many attempts. Please retry in 15 minutes.",
      });
  next();
});
const credentials = [
  body("email").isEmail().isLength({ max: 254 }),
  body("password").isString().isLength({ min: 12, max: 128 }),
];
router.post(
  "/register",
  ...credentials,
  body("name").isString().trim().isLength({ min: 2, max: 120 }),
  validateRequest,
  (req, res) => {
    if (req.body.role && req.body.role !== "Business")
      return res
        .status(403)
        .json({
          success: false,
          error: "Staff accounts must be created by an administrator",
        });
    try {
      const account = createAccount(
        req.body.name,
        req.body.email,
        req.body.password,
        "Business",
      );
      res.status(201).json({ success: true, data: publicAccount(account) });
    } catch (err: any) {
      res.status(409).json({ success: false, error: err.message });
    }
  },
);
router.post(
  "/login",
  body("email").isEmail(),
  body("password").isString().isLength({ min: 1, max: 128 }),
  validateRequest,
  (req, res) => {
    const account = accountStore
      .findAll()
      .find((a) => a.email === req.body.email.trim().toLowerCase());
    if (
      !account ||
      !account.active ||
      !checkPassword(req.body.password, account.passwordHash)
    )
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password" });
    const token = jwt.sign(
      { id: account.id, role: account.role, email: account.email },
      config.jwtSecret,
      { algorithm: "HS256", expiresIn: "8h" },
    );
    res.json({ success: true, data: { token, user: publicAccount(account) } });
  },
);
router.get("/me", authenticate, (req, res) =>
  res.json({
    success: true,
    data: publicAccount(accountStore.findById(req.user!.id)!),
  }),
);
router.get("/staff", authenticate, requireRole(["Administrator"]), (req, res) =>
  res.json({
    success: true,
    data: accountStore
      .findAll()
      .filter((a) => a.role !== "Business")
      .map(publicAccount),
  }),
);
router.post(
  "/staff",
  authenticate,
  requireRole(["Administrator"]),
  ...credentials,
  body("name").isString().trim().isLength({ min: 2, max: 120 }),
  body("role").isIn(roles.filter((r) => r !== "Business")),
  validateRequest,
  (req, res) => {
    try {
      res
        .status(201)
        .json({
          success: true,
          data: publicAccount(
            createAccount(
              req.body.name,
              req.body.email,
              req.body.password,
              req.body.role,
            ),
          ),
        });
    } catch (err: any) {
      res.status(409).json({ success: false, error: err.message });
    }
  },
);
export default router;
