import { z } from 'zod';
import { EMPLOYEE_ROLES } from './employeeRole.constants';

const jobTitleIds = EMPLOYEE_ROLES.map((role) => role.id) as [string, ...string[]];

export const employeeIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Thiếu mã nhân viên'),
});

// Nhân sự vận hành (Hướng A) chỉ là tài khoản LEADER/TECHNICAL trong `users` — không cho tạo
// ADMIN/MANAGER qua endpoint này (2 role đó quản lý qua /users, ngoài phạm vi màn "Nhân viên").
const employeeAccountRoleEnum = z.enum(['LEADER', 'TECHNICAL'], {
  message: 'role không hợp lệ, chỉ chấp nhận LEADER hoặc TECHNICAL',
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
  phone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại'),
  email: z.string().trim().email('Email không đúng định dạng').optional(),
  roleId: z.enum(jobTitleIds, { message: 'roleId không hợp lệ, vui lòng chọn vai trò chuyên môn hợp lệ' }),
  role: employeeAccountRoleEnum.default('TECHNICAL'),
  status: employeeStatusEnum.default('ACTIVE'),
});

export const updateEmployeeBodySchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  phone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại'),
  email: z.string().trim().email('Email không đúng định dạng').optional(),
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
  phone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại'),
  roleId: z.enum(jobTitleIds, { message: 'roleId không hợp lệ, vui lòng chọn vai trò chuyên môn hợp lệ' }),
});

export type EmployeeIdParam = z.infer<typeof employeeIdParamSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>;
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBodySchema>;
export type UpdateEmployeeStatusBody = z.infer<typeof updateEmployeeStatusBodySchema>;
export type InviteEmployeeBody = z.infer<typeof inviteEmployeeBodySchema>;
