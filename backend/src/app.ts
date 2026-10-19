import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import { authenticate, requireRole } from './middlewares/authResolver';
import { businessApplicationRoutes } from './routes/businessApplicationRoutes';
import { staffRoutes } from './routes/staffRoutes';

import { manufacturerRoutes } from './routes/manufacturerRoutes';
import { instrumentRoutes } from './routes/instrumentRoutes';
import { testCaseRoutes } from './routes/testCaseRoutes';
import { observationRoutes } from './routes/observationRoutes';
import { evidenceRoutes } from './routes/evidenceRoutes';
import { reportRoutes } from './routes/reportRoutes';
import { repositoryRoutes } from './routes/repositoryRoutes';
import { nativeRoutes } from './routes/nativeRoutes';

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: '100kb' }));

// Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/staff', authenticate, staffRoutes);
app.use('/api/v1/verification', authenticate, requireRole(['Business']), businessApplicationRoutes);

// Protected Domain Routes
const laboratoryAccess = [authenticate, requireRole(['Technician', 'Reviewer', 'Administrator'])];
app.use('/api/v1/manufacturers', ...laboratoryAccess, manufacturerRoutes);
app.use('/api/v1/instruments', ...laboratoryAccess, instrumentRoutes);
app.use('/api/v1/test-cases', ...laboratoryAccess, testCaseRoutes);
app.use('/api/v1/observations', ...laboratoryAccess, observationRoutes);
app.use('/api/v1/evidence', ...laboratoryAccess, evidenceRoutes);
app.use('/api/v1/reports', ...laboratoryAccess, reportRoutes);
app.use('/api/v1/repository', ...laboratoryAccess, repositoryRoutes);
app.use('/api/v1/native', ...laboratoryAccess, nativeRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: 'Endpoint Not Found' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
