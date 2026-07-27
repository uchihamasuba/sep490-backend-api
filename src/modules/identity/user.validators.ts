import { z } from 'zod';

export const userIdParamSchema = z.object({
  userId: z.string().trim().min(1, 'Thiếu mã người dùng'),
});

const userRoleEnum = z.enum(['ADMIN', 'MANAGER', 'STAFF'], {
  message: 'role không hợp lệ, vui lòng chọn một trong các vai trò được hỗ trợ',
});
const userStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'], {
  message: 'status không hợp lệ, vui lòng chọn một trong các trạng thái được hỗ trợ',
});

export const listUsersQuerySchema = z.object({
  role: userRoleEnum.optional(),
  status: userStatusEnum.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export const updateUserStatusBodySchema = z.object({
  status: userStatusEnum,
});

export const resetUserPasswordBodySchema = z.object({
  newPassword: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export const createUserBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .max(50, 'Tên đăng nhập không được vượt quá 50 ký tự'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  role: userRoleEnum,
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
  phone: z
    .string()
    .regex(/^0[0-9]{9}$/, 'Số điện thoại phải đủ 10 số và bắt đầu bằng số 0')
    .optional()
    .or(z.literal('')),
});

export const updateUserBodySchema = z.object({
  fullName: z.string().trim().min(1, 'Họ tên không được để trống').optional(),
  role: userRoleEnum.optional(),
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
  phone: z
    .string()
    .regex(/^0[0-9]{9}$/, 'Số điện thoại phải đủ 10 số và bắt đầu bằng số 0')
    .nullable()
    .optional()
    .or(z.literal('')),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBodySchema>;
export type ResetUserPasswordBody = z.infer<typeof resetUserPasswordBodySchema>;
export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
