import { z } from 'zod';

export const loginBodySchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const forgotPasswordBodySchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập'),
});

// Reset mật khẩu qua email (khác forgot-password ở trên: dùng email thay vì username, và thực sự
// sinh mật khẩu mới + gửi email, không chỉ log nội bộ).
export const resetPasswordBodySchema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
});

export const updateProfileBodySchema = z.object({
  fullName: z.string().trim().min(1, 'Họ tên không được để trống').optional(),
  phone: z.string().trim().min(1, 'Số điện thoại không được để trống').optional(),
  bio: z.string().trim().optional(),
  avatarUrl: z.string().trim().optional(),
});

export const changePasswordBodySchema = z
  .object({
    oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
    confirmNewPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Mật khẩu nhập lại không khớp với mật khẩu mới',
    path: ['confirmNewPassword'],
  });

export type LoginBody = z.infer<typeof loginBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
