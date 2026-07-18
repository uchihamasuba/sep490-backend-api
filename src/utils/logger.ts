import pino from 'pino';
import { env, isProd } from '../config/env';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  base: { env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
});
