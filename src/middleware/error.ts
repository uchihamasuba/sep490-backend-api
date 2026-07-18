import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { isProd } from '../config/env';
import { logger } from '../utils/logger';

// Registered LAST in app.ts, after every route and after notFound.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err }, err.message);
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: formatZodIssues(err) },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Resource already exists', details: err.meta },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    }
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Invalid request', details: isProd ? undefined : err.message },
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Invalid request data' },
    });
  }

  logger.error({ err, path: req.originalUrl }, 'Unhandled error');
  const message = isProd || !(err instanceof Error) ? 'Internal server error' : err.message;
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  });
}

function formatZodIssues(err: ZodError) {
  return err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}
