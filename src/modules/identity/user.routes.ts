import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { userController } from './user.controller';
import { listUsersQuerySchema, userIdParamSchema } from './user.validators';

const router = Router();

router.use(requireAuth);

// Danh mục nhân sự dùng để chọn người phụ trách (docs/api/kehoachvaphancong_api.md mục 8.3: GET
// /api/v1/users?role=LEADER|TECHNICAL) — đọc được bởi Manager (người lập kế hoạch) và Admin (audit).
router.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listUsersQuerySchema, 'query'),
  asyncHandler(userController.list),
);

router.get(
  '/:userId',
  requireRole('MANAGER', 'ADMIN'),
  validate(userIdParamSchema, 'params'),
  asyncHandler(userController.getById),
);

export default router;
