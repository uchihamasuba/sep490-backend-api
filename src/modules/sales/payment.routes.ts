import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { paymentController } from './payment.controller';
import {
  confirmSettlementBodySchema,
  depositIdParamSchema,
  settlementIdParamSchema,
  updateDepositStatusBodySchema,
} from './payment.validators';

// Mounted at /api/v1/deposits
export const depositRouter = Router();

depositRouter.use(requireAuth);

// Xác nhận cọc/quyết toán — hành động ghi, chỉ Manager (docs/api/tiendosukien_api.md mục 0).
depositRouter.put(
  '/:depositId',
  requireRole('MANAGER'),
  validate(depositIdParamSchema, 'params'),
  validate(updateDepositStatusBodySchema, 'body'),
  asyncHandler(paymentController.updateDepositStatus),
);

// Mounted at /api/v1/settlements
export const settlementRouter = Router();

settlementRouter.use(requireAuth);

settlementRouter.put(
  '/:settlementId/confirm',
  requireRole('MANAGER'),
  validate(settlementIdParamSchema, 'params'),
  validate(confirmSettlementBodySchema, 'body'),
  asyncHandler(paymentController.confirmSettlement),
);
