import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { changeRequestController } from './changeRequest.controller';
import {
  approveChangeRequestBodySchema,
  changeRequestIdParamSchema,
  listChangeRequestsQuerySchema,
} from './changeRequest.validators';

// Mounted at /api/v1/change-requests
export const changeRequestRouter = Router();

changeRequestRouter.use(requireAuth);

// GET gộp toàn hệ thống (chuông "Yêu cầu thay đổi chờ duyệt" ở Header) — dashboard Manager/Admin, giống
// GET /deposits, không mở cho LEADER (Leader xem trạng thái request của mình qua GET /orders/:orderId/...
// nếu cần, chưa yêu cầu ở lượt này).
changeRequestRouter.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listChangeRequestsQuerySchema, 'query'),
  asyncHandler(changeRequestController.list),
);

changeRequestRouter.put(
  '/:changeRequestId/approve',
  requireRole('MANAGER'),
  validate(changeRequestIdParamSchema, 'params'),
  validate(approveChangeRequestBodySchema, 'body'),
  asyncHandler(changeRequestController.approve),
);
