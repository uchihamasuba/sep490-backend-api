import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { notificationController } from './notification.controller';
import { notificationIdParamSchema, registerDeviceTokenSchema, sendNotificationSchema } from './notification.validators';

const router = Router();
router.use(requireAuth);

router.post(
  '/test-send',
  validate(sendNotificationSchema, 'body'),
  asyncHandler(notificationController.testSendNotification),
);
router.get('/', asyncHandler(notificationController.getMyNotifications));
router.patch(
  '/:id/read',
  validate(notificationIdParamSchema, 'params'),
  asyncHandler(notificationController.markNotificationAsRead),
);
router.post(
  '/device-token',
  validate(registerDeviceTokenSchema, 'body'),
  asyncHandler(notificationController.registerDeviceToken),
);

export default router;
