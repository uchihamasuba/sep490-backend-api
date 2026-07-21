import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { paymentController } from './payment.controller';
import {
  confirmSettlementBodySchema,
  depositIdParamSchema,
  listDepositsQuerySchema,
  settlementIdParamSchema,
  updateDepositStatusBodySchema,
} from './payment.validators';

// Mounted at /api/v1/deposits
export const depositRouter = Router();

depositRouter.use(requireAuth);

// GET gộp toàn hệ thống (docs/api/datcoc_api.md mục 1.2/8) — Manager + Admin đều đọc được, giống màn
// "Đặt cọc" tồn tại ở cả /manager/payments/deposits và /admin/orders_audit/payments.
depositRouter.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listDepositsQuerySchema, 'query'),
  asyncHandler(paymentController.listDeposits),
);

// Xác nhận cọc/quyết toán — hành động ghi, chỉ Manager (docs/api/tiendosukien_api.md mục 0).
depositRouter.put(
  '/:depositId',
  requireRole('MANAGER'),
  validate(depositIdParamSchema, 'params'),
  validate(updateDepositStatusBodySchema, 'body'),
  asyncHandler(paymentController.updateDepositStatus),
);

// Chưa có trong đặc tả gốc (docs/api/datcoc_api.md mục 8) — thêm theo yêu cầu, guard trạng thái ở
// service (chỉ PENDING).
depositRouter.delete(
  '/:depositId',
  requireRole('MANAGER'),
  validate(depositIdParamSchema, 'params'),
  asyncHandler(paymentController.deleteDeposit),
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
