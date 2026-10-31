import { Router } from "express";
import { demoCookie, demoRoles, isDemoAccessEnabled, resumeDemoSession, switchDemoRole, DEMO_COOKIE, DemoRole } from "../services/DemoService";
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
// One anonymous demo session per browser profile, reused via its signed token or cookie.
// Both the 24-hour deadline and role transitions are enforced by the backend.
router.post("/demo/start", (req, res) => {
  if (!isDemoAccessEnabled())
    return res.status(404).json({ success: false, error: "Evaluator demo access is not enabled." });
  try {
    const rawCookie = req.headers.cookie?.split(";").map(x => x.trim())
      .find(x => x.startsWith(DEMO_COOKIE + "="))?.slice(DEMO_COOKIE.length + 1);
    const cookieToken = rawCookie ? decodeURIComponent(rawCookie) : undefined;
    const previousToken = cookieToken || req.header("x-w8lab-demo-token") || undefined;
    const access = resumeDemoSession(previousToken);
    res.setHeader("Set-Cookie", demoCookie(access.token, access.demo.expiresAt));
    res.json({ success: true, data: access });
  } catch {
    res.status(500).json({ success: false, error: "Unable to create demo access." });
  }
});

router.post(
  "/demo/switch", authenticate,
  body("role").isIn([...demoRoles]), validateRequest,
  (req, res) => {
    if (!req.user?.demo)
      return res.status(403).json({ success: false, error: "Only evaluator demo sessions can switch demo roles." });
    try {
      const token = req.headers.authorization!.slice("Bearer ".length);
      const access = switchDemoRole(token, req.body.role as DemoRole);
      res.setHeader("Set-Cookie", demoCookie(access.token, access.demo.expiresAt));
      res.json({ success: true, data: access });
    } catch {
      res.status(401).json({ success: false, error: "Demo access expired or invalid." });
    }
  },
);
router.get("/me", authenticate, (req, res) =>
  res.json({
    success: true,
    data: {
      ...publicAccount(accountStore.findById(req.user!.id)!),
      ...(req.user?.demo ? {
        demo: true,
        demoId: "W8-DEMO-" + req.user.demoId!.replace(/-/g, "").slice(0, 12).toUpperCase(),
        demoExpiresAt: req.user.demoExpiresAt,
      } : {}),
    },
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
