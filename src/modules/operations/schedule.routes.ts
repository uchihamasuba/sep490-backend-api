import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { scheduleController } from './schedule.controller';
import {
  addAssigneeBodySchema,
  assigneeParamSchema,
  createSchedulePlanBodySchema,
  listSchedulePlansQuerySchema,
  planIdParamSchema,
  updateSchedulePlanBodySchema,
  updateSchedulePlanStatusBodySchema,
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

scheduleRouter.put(
  '/:planId',
  requireRole('MANAGER'),
  validate(planIdParamSchema, 'params'),
  validate(updateSchedulePlanBodySchema, 'body'),
  asyncHandler(scheduleController.update),
);

// Phân quyền theo trạng thái đích được kiểm tra chi tiết ở service (CONFIRMED/CANCELLED: Manager;
// IN_PROGRESS/COMPLETED: Leader/Technical đang được phân công) — route chỉ chặn trước các role chắc
// chắn không bao giờ được phép (ADMIN chỉ xem/audit theo docs/api/lichtrinhkythuat_api.md mục 0).
scheduleRouter.patch(
  '/:planId/status',
  requireRole('MANAGER', 'LEADER', 'TECHNICAL'),
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
  asyncHandler(scheduleController.checkIn),
);

scheduleRouter.post(
  '/:planId/assignees/:userId/check-out',
  requireRole('LEADER', 'TECHNICAL'),
  validate(assigneeParamSchema, 'params'),
  asyncHandler(scheduleController.checkOut),
);

// Mounted at /api/v1/work-tasks
export const workTaskRouter = Router();

workTaskRouter.use(requireAuth);
workTaskRouter.get('/', asyncHandler(scheduleController.listWorkTasks));
