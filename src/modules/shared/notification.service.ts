import type { Message } from 'firebase-admin/messaging';
import { getFirebaseMessaging } from '../../config/firebase';
import { AppError } from '../../utils/AppError';
import { logDeveloper } from '../../utils/logger';
import { notificationRepository } from './notification.repository';
import type { SendNotificationBody } from './notification.validators';

async function sendNotificationToUser(body: SendNotificationBody) {
  // Notification.userId có FK cứng tới User (onDelete: Cascade) — kiểm tra tồn tại trước để trả 404 rõ
  // ràng thay vì để prisma.notification.create() rơi xuống lỗi FK constraint (P2003) chung chung.
  const user = await notificationRepository.getUserDeviceToken(body.userId);
  if (!user) throw AppError.notFound('Không tìm thấy người dùng');

  const notification = await notificationRepository.createNotification({
    userId: body.userId,
    title: body.title,
    content: body.content ?? null,
  });

  const deviceToken = user.deviceToken ?? null;

  logDeveloper('Device Token check', { userId: body.userId, deviceToken });

  if (deviceToken) {
    const message: Message = {
      token: deviceToken,
      notification: { title: body.title, body: body.content ?? '' },
    };
    await getFirebaseMessaging().send(message);
  }

  return notification;
}

async function getUserNotifications(userId: string) {
  return notificationRepository.findNotificationsByUserId(userId);
}

async function markAsRead(notificationId: string) {
  const existing = await notificationRepository.findById(notificationId);
  if (!existing) throw AppError.notFound('Không tìm thấy thông báo');
  return notificationRepository.markNotificationAsRead(notificationId);
}

async function registerDeviceToken(userId: string, deviceToken: string) {
  return notificationRepository.updateUserDeviceToken(userId, deviceToken);
}

export const notificationService = {
  sendNotificationToUser,
  getUserNotifications,
  markAsRead,
  registerDeviceToken,
};
