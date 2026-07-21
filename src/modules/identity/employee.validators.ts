import { z } from 'zod';
import { EMPLOYEE_ROLES } from './employeeRole.constants';

const jobTitleIds = EMPLOYEE_ROLES.map((role) => role.id) as [string, ...string[]];

export const employeeIdParamSchema = z.object({
  id: z.string().trim().min(1, 'id is required'),
});

// Nhân sự vận hành (Hướng A) chỉ là tài khoản LEADER/TECHNICAL trong `users` — không cho tạo
// ADMIN/MANAGER qua endpoint này (2 role đó quản lý qua /users, ngoài phạm vi màn "Nhân viên").
const employeeAccountRoleEnum = z.enum(['LEADER', 'TECHNICAL']);
// Đã chốt (docs/api/admin_danhsachnguoidung__api.md mục 1): status tĩnh 2 giá trị, không có SUSPENDED
// ở phạm vi màn nhân sự (khác users.status 3 giá trị đầy đủ).
const employeeStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const listEmployeesQuerySchema = z.object({
  roleId: z.enum(jobTitleIds).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(10),
});

export const createEmployeeBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  phone: z.string().trim().min(1, 'phone is required'),
  email: z.string().trim().email().optional(),
  roleId: z.enum(jobTitleIds, { message: 'roleId must be one of the known employee roles' }),
  role: employeeAccountRoleEnum.default('TECHNICAL'),
  status: employeeStatusEnum.default('ACTIVE'),
});

export const updateEmployeeBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  phone: z.string().trim().min(1, 'phone is required'),
  email: z.string().trim().email().optional(),
  roleId: z.enum(jobTitleIds, { message: 'roleId must be one of the known employee roles' }),
  role: employeeAccountRoleEnum.optional(),
  status: employeeStatusEnum.optional(),
});

export const updateEmployeeStatusBodySchema = z.object({
  status: employeeStatusEnum,
});

// Mời nhân viên (invite): khác createEmployeeBodySchema ở chỗ email là bắt buộc (mật khẩu tạm được
// gửi qua email nên bắt buộc phải có nơi để gửi tới).
export const inviteEmployeeBodySchema = z.object({
  email: z.string().trim().min(1, 'email is required').email('email is invalid'),
  fullName: z.string().trim().min(1, 'fullName is required'),
  phone: z.string().trim().min(1, 'phone is required'),
  roleId: z.enum(jobTitleIds, { message: 'roleId must be one of the known employee roles' }),
});

export type EmployeeIdParam = z.infer<typeof employeeIdParamSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>;
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBodySchema>;
export type UpdateEmployeeStatusBody = z.infer<typeof updateEmployeeStatusBodySchema>;
export type InviteEmployeeBody = z.infer<typeof inviteEmployeeBodySchema>;
