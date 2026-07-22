import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { supplierController } from './supplier.controller';
import {
  createSupplierBodySchema,
  listSupplierTransactionsQuerySchema,
  listSuppliersQuerySchema,
  receiveTransactionItemBodySchema,
  supplierIdParamSchema,
  transactionIdParamSchema,
  transactionItemParamSchema,
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

// Nới thêm LEADER (docs/api/api.md gap (h)) để Leader mobile đọc đơn mua/thuê NCC gắn với plan mình
// được phân công — TODO: lọc theo orderId của plan họ được phân công thay vì trả toàn hệ thống.
supplierTransactionRouter.get(
  '/',
  requireRole('MANAGER', 'ADMIN', 'LEADER'),
  validate(listSupplierTransactionsQuerySchema, 'query'),
  asyncHandler(supplierController.listTransactions),
);

// GET chi tiết kèm items[] (docs/api/api.md gap (q)) — LEADER bị giới hạn theo order của plan họ được
// phân công ở tầng service (assertActorCanAccessTransaction), MANAGER/ADMIN không giới hạn.
supplierTransactionRouter.get(
  '/:id',
  requireRole('MANAGER', 'ADMIN', 'LEADER'),
  validate(transactionIdParamSchema, 'params'),
  asyncHandler(supplierController.getTransactionById),
);

// Xác nhận nhận hàng từng dòng (docs/api/api.md gap (i)) — LEADER giới hạn theo order của plan họ được
// phân công (assertActorCanAccessTransaction); MANAGER hỗ trợ sửa lại trên web khi cần.
supplierTransactionRouter.patch(
  '/:transactionId/items/:stItemId',
  requireRole('LEADER', 'MANAGER'),
  validate(transactionItemParamSchema, 'params'),
  validate(receiveTransactionItemBodySchema, 'body'),
  asyncHandler(supplierController.receiveTransactionItem),
);
