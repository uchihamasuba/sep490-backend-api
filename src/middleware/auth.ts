import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import type { AuthPrincipal, UserRole } from '../types/express';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Thiếu hoặc sai định dạng token xác thực'));
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & Partial<AuthPrincipal>;
    if (!payload.id || !payload.role) {
      return next(AppError.unauthorized('Token xác thực không hợp lệ'));
    }
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    next(AppError.unauthorized('Token xác thực không hợp lệ hoặc đã hết hạn'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden('Bạn không đủ quyền để thực hiện thao tác này'));
    next();
  };
}
