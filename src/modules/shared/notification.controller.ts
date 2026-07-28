import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { notificationService } from './notification.service';
import type {
  ListNotificationsQuery,
  NotificationIdParam,
  RegisterDeviceTokenBody,
  SendNotificationBody,
} from './notification.validators';

async function testSendNotification(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const body = req.body as SendNotificationBody;
  const isPrivileged = req.user.role === 'ADMIN' || req.user.role === 'MANAGER';
  if (!isPrivileged && body.userId !== req.user.id) {
    throw AppError.forbidden('Bạn chỉ có thể gửi thông báo thử nghiệm cho chính mình');
  }
  const notification = await notificationService.sendNotificationToUser(body);
  created(res, notification);
}

async function getMyNotifications(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const query = req.query as unknown as ListNotificationsQuery;
  const result = await notificationService.getUserNotifications(req.user.id, query);
  ok(res, result.data, result.meta);
}

async function markNotificationAsRead(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as unknown as NotificationIdParam;
  const notification = await notificationService.markAsRead(id, req.user.id);
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
