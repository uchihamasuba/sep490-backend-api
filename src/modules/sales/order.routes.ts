import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { orderController } from './order.controller';
import {
  createOrderBodySchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderItemsBodySchema,
  updateOrderStatusBodySchema,
} from './order.validators';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listOrdersQuerySchema, 'query'),
  asyncHandler(orderController.list),
);

router.post(
  '/',
  requireRole('MANAGER'),
  validate(createOrderBodySchema, 'body'),
  asyncHandler(orderController.create),
);

router.get(
  '/:orderId',
  requireRole('MANAGER', 'ADMIN'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.getById),
);

router.put(
  '/:orderId/status',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(updateOrderStatusBodySchema, 'body'),
  asyncHandler(orderController.updateStatus),
);

router.put(
  '/:orderId/items',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(updateOrderItemsBodySchema, 'body'),
  asyncHandler(orderController.updateItems),
);

export default router;
