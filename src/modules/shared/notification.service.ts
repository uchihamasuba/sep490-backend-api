import type { Message } from 'firebase-admin/messaging';
import { getFirebaseMessaging } from '../../config/firebase';
import { logDeveloper } from '../../utils/logger';
import { notificationRepository } from './notification.repository';
import type { SendNotificationBody } from './notification.validators';

async function sendNotificationToUser(body: SendNotificationBody) {
  const notification = await notificationRepository.createNotification({
    userId: body.userId,
    title: body.title,
    content: body.content ?? null,
  });

  const user = await notificationRepository.getUserDeviceToken(body.userId);
  const deviceToken = user?.deviceToken ?? null;

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
