import { z } from 'zod';
import { EMPLOYEE_ROLES } from './employeeRole.constants';

const jobTitleIds = EMPLOYEE_ROLES.map((role) => role.id) as [string, ...string[]];

export const employeeIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Thiếu mã nhân viên'),
});

// Nhân sự vận hành (Hướng A) chỉ là tài khoản STAFF trong `users` — không cho tạo ADMIN/MANAGER qua
// endpoint này (2 role đó quản lý qua /users, ngoài phạm vi màn "Nhân viên"). Leader/Technical không
// còn là role hệ thống — vai trò đó nay gán theo từng dự án qua PlanMemberRole (schedule_plan_assignees).
const employeeAccountRoleEnum = z.enum(['STAFF'], {
  message: 'role không hợp lệ, chỉ chấp nhận STAFF',
});
// Đã chốt (docs/api/admin_danhsachnguoidung__api.md mục 1): status tĩnh 2 giá trị, không có SUSPENDED
// ở phạm vi màn nhân sự (khác users.status 3 giá trị đầy đủ).
const employeeStatusEnum = z.enum(['ACTIVE', 'INACTIVE'], {
  message: 'status không hợp lệ, chỉ chấp nhận ACTIVE hoặc INACTIVE',
});

export const listEmployeesQuerySchema = z.object({
  roleId: z.enum(jobTitleIds, { message: 'roleId không hợp lệ, vui lòng chọn vai trò chuyên môn hợp lệ' }).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(10),
});

export const createEmployeeBodySchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  phone: z.string().trim().optional(),
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
  roleId: z.enum(jobTitleIds, { message: 'roleId không hợp lệ, vui lòng chọn vai trò chuyên môn hợp lệ' }),
  role: employeeAccountRoleEnum.default('STAFF'),
  status: employeeStatusEnum.default('ACTIVE'),
});

export const updateEmployeeBodySchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  phone: z.string().trim().optional(),
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
  roleId: z.enum(jobTitleIds, { message: 'roleId không hợp lệ, vui lòng chọn vai trò chuyên môn hợp lệ' }),
  role: employeeAccountRoleEnum.optional(),
  status: employeeStatusEnum.optional(),
});

export const updateEmployeeStatusBodySchema = z.object({
  status: employeeStatusEnum,
});

// Mời nhân viên (invite): khác createEmployeeBodySchema ở chỗ email là bắt buộc (mật khẩu tạm được
// gửi qua email nên bắt buộc phải có nơi để gửi tới).
export const inviteEmployeeBodySchema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  phone: z.string().trim().optional(),
  roleId: z.enum(jobTitleIds, { message: 'roleId không hợp lệ, vui lòng chọn vai trò chuyên môn hợp lệ' }),
});

export type EmployeeIdParam = z.infer<typeof employeeIdParamSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>;
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBodySchema>;
export type UpdateEmployeeStatusBody = z.infer<typeof updateEmployeeStatusBodySchema>;
export type InviteEmployeeBody = z.infer<typeof inviteEmployeeBodySchema>;
