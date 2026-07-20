import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { ok } from '../../utils/response';
import { authService } from './auth.service';
import type { ChangePasswordBody, ForgotPasswordBody, LoginBody, UpdateProfileBody } from './auth.validators';

async function login(req: Request, res: Response) {
  const body = req.body as LoginBody;
  const result = await authService.login(body);
  ok(res, result);
}

async function forgotPassword(req: Request, res: Response) {
  const body = req.body as ForgotPasswordBody;
  await authService.forgotPassword(body.username);
  ok(res, null);
}

async function getProfile(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const profile = await authService.getProfile(req.user.id);
  ok(res, profile);
}

async function updateProfile(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const body = req.body as UpdateProfileBody;
  const profile = await authService.updateProfile(req.user.id, body);
  ok(res, profile);
}

async function changePassword(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const body = req.body as ChangePasswordBody;
  await authService.changePassword(req.user.id, body);
  ok(res, null);
}

export const authController = {
  login,
  forgotPassword,
  getProfile,
  updateProfile,
  changePassword,
};
