import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { employeeController } from './employee.controller';
import {
  createEmployeeBodySchema,
  employeeIdParamSchema,
  inviteEmployeeBodySchema,
  listEmployeesQuerySchema,
  updateEmployeeBodySchema,
  updateEmployeeStatusBodySchema,
} from './employee.validators';

// Mounted at /api/v1/employees — docs/api/admin_danhsachnguoidung__api.md mục 0: Admin đọc+ghi đầy đủ,
// Manager/Leader/Technical chỉ đọc.
const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requireRole('ADMIN', 'MANAGER', 'LEADER', 'TECHNICAL'),
  validate(listEmployeesQuerySchema, 'query'),
  asyncHandler(employeeController.list),
);

router.post(
  '/',
  requireRole('ADMIN'),
  validate(createEmployeeBodySchema, 'body'),
  asyncHandler(employeeController.create),
);

router.post(
  '/invite',
  requireRole('ADMIN'),
  validate(inviteEmployeeBodySchema, 'body'),
  asyncHandler(employeeController.invite),
);

router.get(
  '/:id',
  requireRole('ADMIN', 'MANAGER', 'LEADER', 'TECHNICAL'),
  validate(employeeIdParamSchema, 'params'),
  asyncHandler(employeeController.getById),
);

router.put(
  '/:id',
  requireRole('ADMIN'),
  validate(employeeIdParamSchema, 'params'),
  validate(updateEmployeeBodySchema, 'body'),
  asyncHandler(employeeController.update),
);

router.patch(
  '/:id/status',
  requireRole('ADMIN'),
  validate(employeeIdParamSchema, 'params'),
  validate(updateEmployeeStatusBodySchema, 'body'),
  asyncHandler(employeeController.updateStatus),
);

export default router;
