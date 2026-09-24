import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import { authenticate } from './middlewares/authResolver';

import { manufacturerRoutes } from './routes/manufacturerRoutes';
import { instrumentRoutes } from './routes/instrumentRoutes';
import { testCaseRoutes } from './routes/testCaseRoutes';
import { observationRoutes } from './routes/observationRoutes';

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json());

// Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);

// Protected Domain Routes
app.use('/api/v1/manufacturers', authenticate, manufacturerRoutes);
app.use('/api/v1/instruments', authenticate, instrumentRoutes);
app.use('/api/v1/test-cases', authenticate, testCaseRoutes);
app.use('/api/v1/observations', authenticate, observationRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: 'Endpoint Not Found' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
