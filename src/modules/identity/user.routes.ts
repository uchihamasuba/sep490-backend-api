import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { userController } from './user.controller';
import {
  createUserBodySchema,
  listUsersQuerySchema,
  resetUserPasswordBodySchema,
  updateUserBodySchema,
  updateUserStatusBodySchema,
  userIdParamSchema,
} from './user.validators';

const router = Router();

router.use(requireAuth);

// Danh mục nhân sự dùng để chọn người phụ trách (docs/api/kehoachvaphancong_api.md mục 8.3: GET
// /api/v1/users?role=STAFF) — đọc được bởi Manager (người lập kế hoạch) và Admin (audit).
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

// Đổi trạng thái tài khoản (khóa/mở khóa) — chỉ Admin (docs/api/admin_danhsachnguoidung__api.md mục
// 2.5 tham chiếu pattern userApiService.updateUserStatus đã có sẵn ở tầng FE).
router.patch(
  '/:userId/status',
  requireRole('ADMIN'),
  validate(userIdParamSchema, 'params'),
  validate(updateUserStatusBodySchema, 'body'),
  asyncHandler(userController.updateStatus),
);

router.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  validate(createUserBodySchema, 'body'),
  asyncHandler(userController.create),
);

router.put(
  '/:userId',
  requireRole('ADMIN', 'MANAGER'),
  validate(userIdParamSchema, 'params'),
  validate(updateUserBodySchema, 'body'),
  asyncHandler(userController.update),
);

// Admin đặt lại mật khẩu cho một user cụ thể — mức nhạy cảm tương đương khoá/mở khoá tài khoản nên
// chỉ Admin (giống pattern requireRole('ADMIN') của PATCH /:userId/status ở trên).
router.post(
  '/:userId/reset-password',
  requireRole('ADMIN'),
  validate(userIdParamSchema, 'params'),
  validate(resetUserPasswordBodySchema, 'body'),
  asyncHandler(userController.resetPassword),
);

export default router;
