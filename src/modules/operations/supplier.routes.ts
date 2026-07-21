import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { supplierController } from './supplier.controller';
import {
  createSupplierBodySchema,
  listSupplierTransactionsQuerySchema,
  listSuppliersQuerySchema,
  supplierIdParamSchema,
  updateSupplierBodySchema,
} from './supplier.validators';

// Mounted at /api/v1/suppliers
export const supplierRouter = Router();

supplierRouter.use(requireAuth);

supplierRouter.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listSuppliersQuerySchema, 'query'),
  asyncHandler(supplierController.list),
);

// Ghi (thêm/sửa/khóa-mở khóa) chỉ Manager — docs/api/supplier_api.md mục 0 chưa đủ căn cứ kết luận Admin
// có quyền ghi, giữ nhất quán với CLAUDE.md mục 1 (Admin không xử lý vận hành hằng ngày).
supplierRouter.post(
  '/',
  requireRole('MANAGER'),
  validate(createSupplierBodySchema, 'body'),
  asyncHandler(supplierController.create),
);

supplierRouter.get(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  validate(supplierIdParamSchema, 'params'),
  asyncHandler(supplierController.getById),
);

// Dùng chung cho Sửa và Khóa/Mở khóa — chỉ gửi { status } (docs/api/supplier_api.md mục 3, cột Thao tác).
supplierRouter.put(
  '/:id',
  requireRole('MANAGER'),
  validate(supplierIdParamSchema, 'params'),
  validate(updateSupplierBodySchema, 'body'),
  asyncHandler(supplierController.update),
);

// Mounted at /api/v1/supplier-transactions
export const supplierTransactionRouter = Router();

supplierTransactionRouter.use(requireAuth);

supplierTransactionRouter.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listSupplierTransactionsQuerySchema, 'query'),
  asyncHandler(supplierController.listTransactions),
);
