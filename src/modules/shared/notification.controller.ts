import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { notificationService } from './notification.service';
import type { NotificationIdParam, RegisterDeviceTokenBody, SendNotificationBody } from './notification.validators';

async function testSendNotification(req: Request, res: Response) {
  const body = req.body as SendNotificationBody;
  const notification = await notificationService.sendNotificationToUser(body);
  created(res, notification);
}

async function getMyNotifications(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const notifications = await notificationService.getUserNotifications(req.user.id);
  ok(res, notifications);
}

async function markNotificationAsRead(req: Request, res: Response) {
  const { id } = req.params as unknown as NotificationIdParam;
  const notification = await notificationService.markAsRead(id);
  ok(res, notification);
}

async function registerDeviceToken(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { deviceToken } = req.body as RegisterDeviceTokenBody;
  const user = await notificationService.registerDeviceToken(req.user.id, deviceToken);
  ok(res, user);
}

export const notificationController = {
  testSendNotification,
  getMyNotifications,
  markNotificationAsRead,
  registerDeviceToken,
};
