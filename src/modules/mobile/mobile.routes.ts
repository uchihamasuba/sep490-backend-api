import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { mobileController } from './mobile.controller';
import { createMobileReportBodySchema, mobileOrderIdParamSchema } from './mobile.validators';

// Mounted at /api/v1/mobile/orders.
//
// Chỉ implement 2 endpoint có hợp đồng rõ trong docs/api: `GET /mobile/orders/:id` (đọc chi tiết đơn
// cho Leader/Technical hiện trường — đối xứng an toàn, dùng lại orderService.getOrderById) và
// `POST /mobile/orders/:id/collected-reports` (docs/api/thuhoi_hoankho_api.md mục 3, comment đầu
// src/types/collectedEquipmentReport.ts phía FE — Leader Staff ghi nhận thu hồi thiết bị qua mobile).
//
// KHÔNG implement `POST /api/v1/mobile/orders/:id/` (dấu `/` cuối, không có path segment tiếp theo) —
// route này không xuất hiện trong bất kỳ tài liệu docs/api/*.md nào (đã rà soát toàn bộ), không rõ
// body/hành vi mong muốn. Theo yêu cầu người dùng: cố tình bỏ qua và báo lại cho FE dev xác nhận thay vì
// đoán bừa contract, xem báo cáo cuối phiên làm việc.
const router = Router();

router.use(requireAuth);

router.get(
  '/:id',
  requireRole('LEADER', 'TECHNICAL', 'MANAGER', 'ADMIN'),
  validate(mobileOrderIdParamSchema, 'params'),
  asyncHandler(mobileController.getOrder),
);

router.post(
  '/:id/collected-reports',
  requireRole('LEADER'),
  validate(mobileOrderIdParamSchema, 'params'),
  validate(createMobileReportBodySchema, 'body'),
  asyncHandler(mobileController.submitCollectedReport),
);

export default router;
