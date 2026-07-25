import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound(`Không tìm thấy đường dẫn: ${req.method} ${req.originalUrl}`));
}
