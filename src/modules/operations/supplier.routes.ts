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
  updateSupplierStatusBodySchema,
  assignSupplierItemBodySchema,
  updateSupplierItemBodySchema,
  supplierItemParamSchema,
  createSupplierTransactionBodySchema,
  updateSupplierTransactionBodySchema,
  updateSupplierTransactionStatusBodySchema,
  updateSupplierTransactionPaymentStatusBodySchema,
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
  requireRole('MANAGER', 'ADMIN'),
  validate(createSupplierBodySchema, 'body'),
  asyncHandler(supplierController.create),
);

supplierRouter.get(
  '/next-code',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(supplierController.getNextSupplierCode),
);

supplierRouter.get(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  validate(supplierIdParamSchema, 'params'),
  asyncHandler(supplierController.getById),
);

supplierRouter.get(
  '/:id/items',
  requireRole('MANAGER', 'ADMIN'),
  validate(supplierIdParamSchema, 'params'),
  asyncHandler(supplierController.getItems),
);

// Dùng chung cho Sửa và Khóa/Mở khóa — chỉ gửi { status } (docs/api/supplier_api.md mục 3, cột Thao tác).
supplierRouter.put(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  validate(supplierIdParamSchema, 'params'),
  validate(updateSupplierBodySchema, 'body'),
  asyncHandler(supplierController.update),
);

supplierRouter.patch(
  '/:id/status',
  requireRole('MANAGER', 'ADMIN'),
  validate(supplierIdParamSchema, 'params'),
  validate(updateSupplierStatusBodySchema, 'body'),
  asyncHandler(supplierController.updateStatus),
);

supplierRouter.delete(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  validate(supplierIdParamSchema, 'params'),
  asyncHandler(supplierController.remove),
);

supplierRouter.post(
  '/:id/items',
  requireRole('MANAGER', 'ADMIN'),
  validate(supplierIdParamSchema, 'params'),
  validate(assignSupplierItemBodySchema, 'body'),
  asyncHandler(supplierController.assignItem),
);

supplierRouter.put(
  '/:id/items/:itemId',
  requireRole('MANAGER', 'ADMIN'),
  validate(supplierItemParamSchema, 'params'),
  validate(updateSupplierItemBodySchema, 'body'),
  asyncHandler(supplierController.updateItem),
);

supplierRouter.delete(
  '/:id/items/:itemId',
  requireRole('MANAGER', 'ADMIN'),
  validate(supplierItemParamSchema, 'params'),
  asyncHandler(supplierController.removeItem),
);

// Mounted at /api/v1/supplier-transactions
export const supplierTransactionRouter = Router();

supplierTransactionRouter.use(requireAuth);

// Nới thêm LEADER (docs/api/api.md gap (h)) để Leader mobile đọc đơn mua/thuê NCC gắn với plan mình
// được phân công — TODO: lọc theo orderId của plan họ được phân công thay vì trả toàn hệ thống.
supplierTransactionRouter.get(
  '/',
  requireRole('MANAGER', 'ADMIN', 'STAFF'),
  validate(listSupplierTransactionsQuerySchema, 'query'),
  asyncHandler(supplierController.listTransactions),
);

// GET chi tiết kèm items[] (docs/api/api.md gap (q)) — LEADER bị giới hạn theo order của plan họ được
// phân công ở tầng service (assertActorCanAccessTransaction), MANAGER/ADMIN không giới hạn.
supplierTransactionRouter.get(
  '/:id',
  requireRole('MANAGER', 'ADMIN', 'STAFF'),
  validate(transactionIdParamSchema, 'params'),
  asyncHandler(supplierController.getTransactionById),
);

// Xác nhận nhận hàng từng dòng (docs/api/api.md gap (i)) — LEADER giới hạn theo order của plan họ được
// phân công (assertActorCanAccessTransaction); MANAGER hỗ trợ sửa lại trên web khi cần.
supplierTransactionRouter.patch(
  '/:transactionId/items/:stItemId',
  requireRole('STAFF', 'MANAGER', 'ADMIN'),
  validate(transactionItemParamSchema, 'params'),
  validate(receiveTransactionItemBodySchema, 'body'),
  asyncHandler(supplierController.receiveTransactionItem),
);

supplierTransactionRouter.post(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(createSupplierTransactionBodySchema, 'body'),
  asyncHandler(supplierController.createTransaction),
);

supplierTransactionRouter.put(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  validate(transactionIdParamSchema, 'params'),
  validate(updateSupplierTransactionBodySchema, 'body'),
  asyncHandler(supplierController.updateTransaction),
);

supplierTransactionRouter.delete(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  validate(transactionIdParamSchema, 'params'),
  asyncHandler(supplierController.deleteTransaction),
);

supplierTransactionRouter.patch(
  '/:id/status',
  requireRole('MANAGER', 'ADMIN'),
  validate(transactionIdParamSchema, 'params'),
  validate(updateSupplierTransactionStatusBodySchema, 'body'),
  asyncHandler(supplierController.updateTransactionStatus),
);

// Xác nhận "đã nhận" (Đã duyệt → Đã nhận) — mở cho STAFF LEAD (giới hạn theo đơn họ phụ trách, chỉ đơn gắn
// order) + Manager/Admin. Endpoint riêng, KHÔNG mở cả /:id/status cho STAFF (đó vẫn Manager/Admin-only).
supplierTransactionRouter.post(
  '/:id/receive',
  requireRole('STAFF', 'MANAGER', 'ADMIN'),
  validate(transactionIdParamSchema, 'params'),
  asyncHandler(supplierController.receiveTransaction),
);

supplierTransactionRouter.patch(
  '/:id/payment-status',
  requireRole('MANAGER', 'ADMIN'),
  validate(transactionIdParamSchema, 'params'),
  validate(updateSupplierTransactionPaymentStatusBodySchema, 'body'),
  asyncHandler(supplierController.updateTransactionPaymentStatus),
);
