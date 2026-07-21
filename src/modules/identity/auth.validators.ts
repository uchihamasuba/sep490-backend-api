import { z } from 'zod';

export const loginBodySchema = z.object({
  username: z.string().trim().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
});

export const forgotPasswordBodySchema = z.object({
  username: z.string().trim().min(1, 'username is required'),
});

// Reset mật khẩu qua email (khác forgot-password ở trên: dùng email thay vì username, và thực sự
// sinh mật khẩu mới + gửi email, không chỉ log nội bộ).
export const resetPasswordBodySchema = z.object({
  email: z.string().trim().min(1, 'email is required').email('email is invalid'),
});

export const updateProfileBodySchema = z.object({
  fullName: z.string().trim().min(1, 'fullName cannot be empty').optional(),
  phone: z.string().trim().min(1, 'phone cannot be empty').optional(),
  bio: z.string().trim().optional(),
  avatarUrl: z.string().trim().optional(),
});

export const changePasswordBodySchema = z
  .object({
    oldPassword: z.string().min(1, 'oldPassword is required'),
    newPassword: z.string().min(6, 'newPassword must be at least 6 characters'),
    confirmNewPassword: z.string().min(1, 'confirmNewPassword is required'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'confirmNewPassword does not match newPassword',
    path: ['confirmNewPassword'],
  });

export type LoginBody = z.infer<typeof loginBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
