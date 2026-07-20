import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { policyController } from './policy.controller';
import { listPoliciesQuerySchema } from './policy.validators';

// Mounted at /api/v1/policies — danh mục tĩnh (chính sách cọc/hủy/đền bù/phí), chỉ đọc, mọi role đã
// đăng nhập đều xem được (dùng khi tạo Order/Settlement cần tra cứu chính sách).
const router = Router();

router.use(requireAuth);

router.get('/', validate(listPoliciesQuerySchema, 'query'), asyncHandler(policyController.list));

export default router;
