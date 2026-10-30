import app from './app';
import { evaluatorDemoEnabled, cleanupExpiredEvaluatorWorkspaces } from './services/EvaluatorDemoService';
import { config } from './config/env';
import { logger } from './utils/logger';

const startServer = () => {
  if (evaluatorDemoEnabled()) {
    cleanupExpiredEvaluatorWorkspaces();
    const cleanup = setInterval(() => {
      try { cleanupExpiredEvaluatorWorkspaces(); }
      catch (error) { logger.error('Demo cleanup failed', error); }
    }, 60 * 1000);
    cleanup.unref();
  }
  try {
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
