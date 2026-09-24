import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-safe-secret-do-not-use-in-prod',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};
