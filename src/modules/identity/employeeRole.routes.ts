import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import { ok } from '../../utils/response';
import { EMPLOYEE_ROLES } from './employeeRole.constants';

// Mounted at /api/v1/employee-roles — Hướng A đã chốt (docs/api/admin_themnhansu_api.md mục 3.4):
// KHÔNG có bảng employee_roles thật (users chỉ có job_title free-text), nên danh mục này là DANH SÁCH
// TĨNH cấu hình cứng ở backend, không phải catalog CRUD. GET giữ đúng hợp đồng cũ để FE không phải sửa
// gì; POST/PUT/DELETE bị từ chối 405 vì không có bản ghi nào để sửa/xóa — endpoint tồn tại (đúng path
// đã yêu cầu) nhưng có chủ đích không làm gì, khác với 404 (không tồn tại route).
function notEditable() {
  return AppError.badRequest(
    'Danh mục vai trò chuyên môn hiện là danh sách tĩnh cấu hình ở backend (không có bảng employee_roles thật) — không thể thêm/sửa/xóa qua API. Xem docs/api/admin_themnhansu_api.md mục 3.4.',
  );
}

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(async (_req, res) => ok(res, EMPLOYEE_ROLES)));

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async () => {
    throw notEditable();
  }),
);

router.put(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async () => {
    throw notEditable();
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async () => {
    throw notEditable();
  }),
);

export default router;
