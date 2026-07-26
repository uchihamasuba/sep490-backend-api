import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import type { AuthPrincipal, UserRole } from '../types/express';

// Endpoint được phép truy cập ngay cả khi tài khoản đang bị bắt đổi mật khẩu (mustChangePassword) —
// đủ để user tự đổi mật khẩu và xem hồ sơ của chính mình trước khi mở khoá phần còn lại của API.
const MUST_CHANGE_PASSWORD_ALLOWLIST: Array<{ method: string; suffix: string }> = [
  { method: 'PUT', suffix: '/auth/change-password' },
  { method: 'GET', suffix: '/auth/profile' },
];

function isAllowedWhileMustChangePassword(req: Request): boolean {
  const path = req.originalUrl.split('?')[0];
  return MUST_CHANGE_PASSWORD_ALLOWLIST.some(({ method, suffix }) => req.method === method && path.endsWith(suffix));
}

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
    req.user = { id: payload.id, role: payload.role, mustChangePassword: Boolean(payload.mustChangePassword) };

    if (req.user.mustChangePassword && !isAllowedWhileMustChangePassword(req)) {
      return next(
        AppError.forbidden('Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống', {
          code: 'MUST_CHANGE_PASSWORD',
        }),
      );
    }

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
