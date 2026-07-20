import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { policyController } from './policy.controller';
import { createPolicyBodySchema, listPoliciesQuerySchema, policyIdParamSchema, updatePolicyBodySchema } from './policy.validators';

// Mounted at /api/v1/policies — danh mục chính sách (cọc/hủy/đền bù/phí/tiền công), đọc mở cho mọi role
// đã đăng nhập (Manager cần tra cứu ở màn chi tiết báo giá — docs/api/admin_chinhsach_api.md mục 0);
// ghi (POST/PUT) chỉ Admin (master-data:manage). Không có DELETE — đã chốt dùng PUT { isActive: false }
// thay cho xóa cứng (mục 6.1 cùng tài liệu), vì policy có thể đã được tham chiếu bởi báo giá/đơn cũ.
const router = Router();

router.use(requireAuth);

router.get('/', validate(listPoliciesQuerySchema, 'query'), asyncHandler(policyController.list));

router.post(
  '/',
  requireRole('ADMIN'),
  validate(createPolicyBodySchema, 'body'),
  asyncHandler(policyController.create),
);

router.put(
  '/:policyId',
  requireRole('ADMIN'),
  validate(policyIdParamSchema, 'params'),
  validate(updatePolicyBodySchema, 'body'),
  asyncHandler(policyController.update),
);

export default router;
