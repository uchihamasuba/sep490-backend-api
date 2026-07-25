import { z } from 'zod';

export const sendNotificationSchema = z.object({
  userId: z.string().trim().min(1, 'Thiếu mã người dùng'),
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề'),
  content: z.string().trim().optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Thiếu mã thông báo'),
});

export const registerDeviceTokenSchema = z.object({
  deviceToken: z.string().trim().min(1, 'Thiếu device token'),
});

export type SendNotificationBody = z.infer<typeof sendNotificationSchema>;
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
export type RegisterDeviceTokenBody = z.infer<typeof registerDeviceTokenSchema>;
