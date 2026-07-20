import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { quotationController } from './quotation.controller';
import {
  createQuotationBodySchema,
  customerIdParamSchema,
  listCustomerQuotationsQuerySchema,
  listQuotationsQuerySchema,
  quotationIdParamSchema,
  updateQuotationBodySchema,
  updateQuotationStatusBodySchema,
} from './quotation.validators';

// Mounted at /api/v1/quotations
export const quotationRouter = Router();

quotationRouter.use(requireAuth);

quotationRouter.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listQuotationsQuerySchema, 'query'),
  asyncHandler(quotationController.list),
);

quotationRouter.get(
  '/:quotationId',
  requireRole('MANAGER', 'ADMIN'),
  validate(quotationIdParamSchema, 'params'),
  asyncHandler(quotationController.getById),
);

quotationRouter.put(
  '/:quotationId',
  requireRole('MANAGER'),
  validate(quotationIdParamSchema, 'params'),
  validate(updateQuotationBodySchema, 'body'),
  asyncHandler(quotationController.update),
);

quotationRouter.patch(
  '/:quotationId/status',
  requireRole('MANAGER'),
  validate(quotationIdParamSchema, 'params'),
  validate(updateQuotationStatusBodySchema, 'body'),
  asyncHandler(quotationController.updateStatus),
);

quotationRouter.delete(
  '/:quotationId',
  requireRole('MANAGER'),
  validate(quotationIdParamSchema, 'params'),
  asyncHandler(quotationController.remove),
);

// Mounted at /api/v1/customers/:customerId/quotations
export const customerQuotationRouter = Router();

customerQuotationRouter.use(requireAuth);

customerQuotationRouter.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(customerIdParamSchema, 'params'),
  validate(listCustomerQuotationsQuerySchema, 'query'),
  asyncHandler(quotationController.listByCustomer),
);

customerQuotationRouter.post(
  '/',
  requireRole('MANAGER'),
  validate(customerIdParamSchema, 'params'),
  validate(createQuotationBodySchema, 'body'),
  asyncHandler(quotationController.createForCustomer),
);
