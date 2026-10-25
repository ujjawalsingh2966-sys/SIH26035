import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import { verificationRoutes } from "./routes/verificationRoutes";
import { evaluatorDemoRoutes } from "./routes/evaluatorDemoRoutes";
import { authenticate, requireRole } from "./middlewares/authResolver";

import { manufacturerRoutes } from "./routes/manufacturerRoutes";
import { instrumentRoutes } from "./routes/instrumentRoutes";
import { testCaseRoutes } from "./routes/testCaseRoutes";
import { observationRoutes } from "./routes/observationRoutes";
import { evidenceRoutes } from "./routes/evidenceRoutes";
import { reportRoutes } from "./routes/reportRoutes";
import { repositoryRoutes } from "./routes/repositoryRoutes";

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json());

// Routes
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/evaluator-demo", evaluatorDemoRoutes);
app.use("/api/v1/verification", verificationRoutes);

// Protected Domain Routes
app.use(
  "/api/v1/manufacturers",
  authenticate,
  requireRole(["Technician", "Reviewer", "Administrator"]),
  manufacturerRoutes,
);
app.use(
  "/api/v1/instruments",
  authenticate,
  requireRole(["Technician", "Reviewer", "Administrator"]),
  instrumentRoutes,
);
app.use(
  "/api/v1/test-cases",
  authenticate,
  requireRole(["Technician", "Reviewer", "Administrator"]),
  testCaseRoutes,
);
app.use(
  "/api/v1/observations",
  authenticate,
  requireRole(["Technician", "Reviewer", "Administrator"]),
  observationRoutes,
);
app.use(
  "/api/v1/evidence",
  authenticate,
  requireRole(["Technician", "Reviewer", "Administrator"]),
  evidenceRoutes,
);
app.use(
  "/api/v1/reports",
  authenticate,
  requireRole(["Technician", "Reviewer", "Administrator"]),
  reportRoutes,
);
app.use(
  "/api/v1/repository",
  authenticate,
  requireRole(["Technician", "Reviewer", "Administrator"]),
  repositoryRoutes,
);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: "Endpoint Not Found" });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
