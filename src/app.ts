import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import './config/zodLocale';
import { env } from './config/env';
import { logger } from './utils/logger';
import apiRouter from './routes';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/error';

export const app = express();

// Middleware chain -> mount router -> error handlers. ORDER MATTERS.
app.use(helmet());

// CORS: hỗ trợ NHIỀU origin (ngăn cách bằng dấu phẩy trong biến CORS_ORIGIN), tha thứ dấu "/" cuối và
// khoảng trắng; hỗ trợ wildcard subdomain kiểu "*.vercel.app" (khớp mọi preview deploy). Request KHÔNG kèm
// Origin (server-to-server, curl, health-check) vẫn cho qua. Origin không khớp bị chặn "mềm" (không gắn
// header CORS) thay vì ném 500, và ghi log để dễ chẩn đoán.
const normalizeOrigin = (value: string): string => value.trim().replace(/\/+$/, '');
const allowedOrigins = env.CORS_ORIGIN.split(',').map(normalizeOrigin).filter(Boolean);
const isOriginAllowed = (origin: string): boolean => {
  const target = normalizeOrigin(origin);
  return allowedOrigins.some((allowed) => {
    if (allowed === target) return true;
    if (!allowed.includes('*')) return false;
    const pattern = `^${allowed.replace(/[.]/g, '\\.').replace(/\*/g, '[^.]+')}$`;
    return new RegExp(pattern).test(target);
  });
};
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin, allowedOrigins }, 'CORS: origin bị từ chối');
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.use('/api/v1', apiRouter);

app.use(notFound);
app.use(errorHandler);
