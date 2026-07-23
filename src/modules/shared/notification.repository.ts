import type { NotificationType } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface CreateNotificationData {
  userId: string;
  title: string;
  content?: string | null;
  notificationType?: NotificationType;
  refType?: string | null;
  refId?: string | null;
}

export const notificationRepository = {
  createNotification(data: CreateNotificationData) {
    return prisma.notification.create({ data });
  },

  getUserDeviceToken(userId: string) {
    return prisma.user.findUnique({ where: { userId }, select: { deviceToken: true } });
  },

  findNotificationsByUserId(userId: string) {
    return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  },

  markNotificationAsRead(notificationId: string) {
    return prisma.notification.update({
      where: { notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  updateUserDeviceToken(userId: string, deviceToken: string) {
    return prisma.user.update({ where: { userId }, data: { deviceToken }, select: { userId: true, deviceToken: true } });
  },
};
