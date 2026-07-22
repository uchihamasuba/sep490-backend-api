import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { scheduleController } from './schedule.controller';
import {
  addAssigneeBodySchema,
  assigneeParamSchema,
  attachEvidenceBodySchema,
  batchUpdateSchedulePlanStatusBodySchema,
  checkInBodySchema,
  createSchedulePlanBodySchema,
  createSchedulePlansBatchBodySchema,
  listSchedulePlansQuerySchema,
  planIdParamSchema,
  updateSchedulePlanBodySchema,
  updateSchedulePlanStatusBodySchema,
  warehouseMovementBodySchema,
} from './schedule.validators';

// Mounted at /api/v1/schedule-plans
export const scheduleRouter = Router();

scheduleRouter.use(requireAuth);

scheduleRouter.get('/', validate(listSchedulePlansQuerySchema, 'query'), asyncHandler(scheduleController.list));

scheduleRouter.get(
  '/:planId',
  validate(planIdParamSchema, 'params'),
  asyncHandler(scheduleController.getById),
);

scheduleRouter.post(
  '/',
  requireRole('MANAGER'),
  validate(createSchedulePlanBodySchema, 'body'),
  asyncHandler(scheduleController.create),
);

scheduleRouter.post(
  '/batch',
  requireRole('MANAGER'),
  validate(createSchedulePlansBatchBodySchema, 'body'),
  asyncHandler(scheduleController.createBatch),
);

// Không có trong đặc tả gốc (docs/api/kehoachvaphancong_api.md khuyến nghị PATCH .../status CANCELLED
// thay vì xóa cứng) — thêm theo yêu cầu, guard trạng thái xử lý ở service (chỉ PENDING/CANCELLED).
scheduleRouter.delete(
  '/:planId',
  requireRole('MANAGER'),
  validate(planIdParamSchema, 'params'),
  asyncHandler(scheduleController.remove),
);

scheduleRouter.put(
  '/:planId',
  requireRole('MANAGER'),
  validate(planIdParamSchema, 'params'),
  validate(updateSchedulePlanBodySchema, 'body'),
  asyncHandler(scheduleController.update),
);

// Đăng ký TRƯỚC `/:planId/status` — nếu không "batch" sẽ bị nuốt làm giá trị planId (Express khớp theo
// thứ tự đăng ký, giống ghi chú "/next-code" ở customer.routes.ts).
scheduleRouter.patch(
  '/batch/status',
  requireRole('MANAGER'),
  validate(batchUpdateSchedulePlanStatusBodySchema, 'body'),
  asyncHandler(scheduleController.updateStatusBatch),
);

// Manager (xác nhận/hủy) + Leader (docs/api/api.md gap (c), đã chốt 2026-07-22: Leader tự xác nhận
// CONFIRMED cho plan mình giữ vai trò LEAD; hủy CANCELLED vẫn chỉ Manager — ràng buộc chi tiết ở
// scheduleService.updateSchedulePlanStatus). IN_PROGRESS/COMPLETED vẫn không qua đây (đã chốt ở
// docs/api/more-require.md mục (ae)) — tự suy ra ở tầng service khi assignee LEAD check-in/check-out.
scheduleRouter.patch(
  '/:planId/status',
  requireRole('MANAGER', 'LEADER'),
  validate(planIdParamSchema, 'params'),
  validate(updateSchedulePlanStatusBodySchema, 'body'),
  asyncHandler(scheduleController.updateStatus),
);

scheduleRouter.post(
  '/:planId/assignees',
  requireRole('MANAGER'),
  validate(planIdParamSchema, 'params'),
  validate(addAssigneeBodySchema, 'body'),
  asyncHandler(scheduleController.addAssignee),
);

scheduleRouter.delete(
  '/:planId/assignees/:userId',
  requireRole('MANAGER'),
  validate(assigneeParamSchema, 'params'),
  asyncHandler(scheduleController.removeAssignee),
);

scheduleRouter.post(
  '/:planId/assignees/:userId/check-in',
  requireRole('LEADER', 'TECHNICAL'),
  validate(assigneeParamSchema, 'params'),
  validate(checkInBodySchema, 'body'),
  asyncHandler(scheduleController.checkIn),
);

scheduleRouter.post(
  '/:planId/assignees/:userId/check-out',
  requireRole('LEADER', 'TECHNICAL'),
  validate(assigneeParamSchema, 'params'),
  asyncHandler(scheduleController.checkOut),
);

// Gắn schedule_plans.evidence_id độc lập với transition status (docs/api/more-require.md mục (ag)) —
// thay cho đường cũ PATCH .../status { COMPLETED, evidenceId } không còn dùng được. Không bắt buộc,
// không gắn với trạng thái nào — bất kỳ ai được phân công vào plan (LEAD/TECHNICAL) đều gắn được.
scheduleRouter.patch(
  '/:planId/evidence',
  requireRole('LEADER', 'TECHNICAL'),
  validate(planIdParamSchema, 'params'),
  validate(attachEvidenceBodySchema, 'body'),
  asyncHandler(scheduleController.attachEvidence),
);

// Leader ghi nhận xuất kho doanh nghiệp tại hiện trường (docs/api/api.md gap (g), TSK-SETUP) — chỉ
// Leader giữ vai trò LEAD của đúng plan đó (guard chi tiết ở inventoryService.recordFieldOutbound).
scheduleRouter.post(
  '/:planId/warehouse-movement',
  requireRole('LEADER'),
  validate(planIdParamSchema, 'params'),
  validate(warehouseMovementBodySchema, 'body'),
  asyncHandler(scheduleController.recordWarehouseMovement),
);

// Mounted at /api/v1/work-tasks
export const workTaskRouter = Router();

workTaskRouter.use(requireAuth);
workTaskRouter.get('/', asyncHandler(scheduleController.listWorkTasks));
