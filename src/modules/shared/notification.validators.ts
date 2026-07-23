import { z } from 'zod';

export const sendNotificationSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
  title: z.string().trim().min(1, 'title is required'),
  content: z.string().trim().optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().trim().min(1, 'notification id is required'),
});

export const registerDeviceTokenSchema = z.object({
  deviceToken: z.string().trim().min(1, 'deviceToken is required'),
});

export type SendNotificationBody = z.infer<typeof sendNotificationSchema>;
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
export type RegisterDeviceTokenBody = z.infer<typeof registerDeviceTokenSchema>;
