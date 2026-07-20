import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { eventController } from './event.controller';
import { eventOrderIdParamSchema } from './event.validators';

const router = Router();

router.use(requireAuth);

// Đọc tổng hợp — mọi hành động ghi (đổi trạng thái đơn, kế hoạch, khảo sát...) đã có endpoint riêng ở
// module sales (orders) và các domain khác của operations (schedule-plans, survey-reports).
router.get(
  '/:orderId/overview',
  requireRole('MANAGER', 'ADMIN'),
  validate(eventOrderIdParamSchema, 'params'),
  asyncHandler(eventController.getOverview),
);

export default router;
