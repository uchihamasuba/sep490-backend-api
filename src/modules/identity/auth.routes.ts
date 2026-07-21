import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { authController } from './auth.controller';
import {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  resetPasswordBodySchema,
  updateProfileBodySchema,
} from './auth.validators';

const router = Router();

router.post('/login', validate(loginBodySchema, 'body'), asyncHandler(authController.login));

router.post(
  '/forgot-password',
  validate(forgotPasswordBodySchema, 'body'),
  asyncHandler(authController.forgotPassword),
);

router.post(
  '/reset-password',
  validate(resetPasswordBodySchema, 'body'),
  asyncHandler(authController.resetPassword),
);

router.get('/profile', requireAuth, asyncHandler(authController.getProfile));

router.put(
  '/profile',
  requireAuth,
  validate(updateProfileBodySchema, 'body'),
  asyncHandler(authController.updateProfile),
);

router.put(
  '/change-password',
  requireAuth,
  validate(changePasswordBodySchema, 'body'),
  asyncHandler(authController.changePassword),
);

export default router;
