import app from './app';
import { config } from './config/env';
import { logger } from './utils/logger';

const startServer = () => {
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
