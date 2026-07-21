import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { customerController } from './customer.controller';
import {
  createCustomerBodySchema,
  customerIdParamSchema,
  listCustomerOrdersQuerySchema,
  listCustomersQuerySchema,
  updateCustomerBodySchema,
} from './customer.validators';

const router = Router();

router.use(requireAuth);
// tương ứng với /api/v1/customers
router.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listCustomersQuerySchema, 'query'),
  asyncHandler(customerController.list),
);

router.post(
  '/',
  requireRole('MANAGER'),
  validate(createCustomerBodySchema, 'body'),
  asyncHandler(customerController.create),
);

// Đăng ký TRƯỚC `/:customerId` — nếu không "next-code" sẽ bị nuốt làm giá trị customerId (Express khớp
// theo thứ tự đăng ký).
router.get('/next-code', requireRole('MANAGER', 'ADMIN'), asyncHandler(customerController.nextCode));

router.get(
  '/:customerId',
  requireRole('MANAGER', 'ADMIN'),
  validate(customerIdParamSchema, 'params'),
  asyncHandler(customerController.getById),
);

router.put(
  '/:customerId',
  requireRole('MANAGER'),
  validate(customerIdParamSchema, 'params'),
  validate(updateCustomerBodySchema, 'body'),
  asyncHandler(customerController.update),
);

router.delete(
  '/:customerId',
  requireRole('MANAGER'),
  validate(customerIdParamSchema, 'params'),
  asyncHandler(customerController.remove),
);

router.get(
  '/:customerId/summary',
  requireRole('MANAGER', 'ADMIN'),
  validate(customerIdParamSchema, 'params'),
  asyncHandler(customerController.summary),
);

router.get(
  '/:customerId/orders',
  requireRole('MANAGER', 'ADMIN'),
  validate(customerIdParamSchema, 'params'),
  validate(listCustomerOrdersQuerySchema, 'query'),
  asyncHandler(customerController.orders),
);

export default router;
