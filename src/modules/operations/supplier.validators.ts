import { z } from 'zod';

export const supplierIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Thiếu mã nhà cung cấp'),
});

export const supplierItemParamSchema = z.object({
  id: z.string().trim().min(1, 'Thiếu mã nhà cung cấp'),
  itemId: z.string().trim().min(1, 'Thiếu mã mặt hàng'),
});

const activeStatusEnum = z.enum(['ACTIVE', 'INACTIVE'], { message: 'status không hợp lệ, chỉ chấp nhận ACTIVE hoặc INACTIVE' });

export const listSuppliersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: activeStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export const listSupplierItemsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

// Không nhận `email` dù model Supplier có cột này — đã chốt ở docs/api/supplier_api.md mục 1.3/5
// (createSupplierSchema thật không nhận field này, tránh gây hiểu nhầm là lưu được).
export const createSupplierBodySchema = z.object({
  supplierCode: z.string().trim().min(1, 'Vui lòng nhập mã nhà cung cấp'),
  supplierName: z.string().trim().min(1, 'Vui lòng nhập tên nhà cung cấp'),
  serviceType: z.string().trim().min(1, 'Vui lòng nhập loại hình dịch vụ'),
  phone: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  contactPerson: z.string().trim().min(1).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  notes: z.string().trim().optional(),
  status: activeStatusEnum.default('ACTIVE'),
});

// supplierCode bị khóa khi sửa (docs/api/supplier_api.md mục 5) — không có trong payload update.
// Dùng chung endpoint này cho cả Sửa và Khóa/Mở khóa (chỉ gửi { status }) — mục 3 cột Thao tác.
export const updateSupplierBodySchema = z
  .object({
    supplierName: z.string().trim().min(1).optional(),
    serviceType: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    contactPerson: z.string().trim().min(1).optional(),
    rating: z.coerce.number().min(0).max(5).optional(),
    notes: z.string().trim().optional(),
    status: activeStatusEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Vui lòng cung cấp ít nhất một trường thông tin' });

export const updateSupplierStatusBodySchema = z.object({
  status: activeStatusEnum,
});

export const assignSupplierItemBodySchema = z.object({
  itemId: z.string().uuid('ID mặt hàng không hợp lệ'),
  rentalPrice: z.number().min(0, 'Giá thuê không được âm').default(0),
  purchasePrice: z.number().min(0, 'Giá mua không được âm').default(0),
  isActive: z.boolean().default(true),
  minQuantity: z.number().int('Số lượng tối thiểu phải là số nguyên').min(0).nullable().optional(),
  supplierItemCode: z.string().max(50, 'Mã mặt hàng NCC quá dài').nullable().optional(),
});

export const updateSupplierItemBodySchema = z.object({
  rentalPrice: z.number().min(0, 'Giá thuê không được âm').optional(),
  purchasePrice: z.number().min(0, 'Giá mua không được âm').optional(),
  isActive: z.boolean().optional(),
  minQuantity: z.number().int('Số lượng tối thiểu phải là số nguyên').min(0).nullable().optional(),
  supplierItemCode: z.string().max(50, 'Mã mặt hàng NCC quá dài').nullable().optional(),
});

const supplierTransactionStatusEnum = z.enum(['PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
  message: 'status không hợp lệ',
});

export const listSupplierTransactionsQuerySchema = z.object({
  supplierId: z.string().trim().min(1).optional(),
  orderId: z.string().trim().min(1).optional(),
  status: supplierTransactionStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

const supplierTransactionTypeEnum = z.enum(['PURCHASE', 'RENTAL'], { message: 'Loại giao dịch không hợp lệ' });

const transactionItemInputSchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã hàng hóa'),
  quantity: z.coerce.number().int().positive('Số lượng phải lớn hơn 0'),
  unitCost: z.coerce.number().nonnegative('Đơn giá phải >= 0').optional(),
  notes: z.string().trim().optional(),
});

export const createSupplierTransactionBodySchema = z.object({
  supplierId: z.string().trim().min(1, 'Thiếu mã nhà cung cấp'),
  orderId: z.string().trim().optional(),
  transactionType: supplierTransactionTypeEnum,
  serviceTitle: z.string().trim().min(1, 'Thiếu tiêu đề dịch vụ'),
  depositAmount: z.coerce.number().nonnegative('Tiền cọc không được âm').default(0),
  items: z.array(transactionItemInputSchema).min(1, 'Phải có ít nhất 1 hàng hóa'),
}).superRefine((data, ctx) => {
  if (data.transactionType === 'RENTAL' && !data.orderId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Giao dịch thuê (RENTAL) bắt buộc phải gắn với một đơn hàng (orderId)',
      path: ['orderId'],
    });
  }
});

export const updateSupplierTransactionBodySchema = z.object({
  serviceTitle: z.string().trim().min(1, 'Thiếu tiêu đề dịch vụ').optional(),
  depositAmount: z.coerce.number().nonnegative('Tiền cọc không được âm').optional(),
  items: z.array(transactionItemInputSchema).min(1, 'Phải có ít nhất 1 hàng hóa').optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'Vui lòng cung cấp ít nhất một trường thông tin' });

export const updateSupplierTransactionStatusBodySchema = z.object({
  status: supplierTransactionStatusEnum,
});

const paymentStatusEnum = z.enum(['UNPAID', 'DEPOSITED', 'PAID'], {
  message: 'paymentStatus không hợp lệ',
});

export const updateSupplierTransactionPaymentStatusBodySchema = z.object({
  paymentStatus: paymentStatusEnum,
});

export const transactionIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Thiếu mã giao dịch'),
});

export const transactionItemParamSchema = z.object({
  transactionId: z.string().trim().min(1, 'Thiếu mã giao dịch'),
  stItemId: z.string().trim().min(1, 'Thiếu mã dòng hàng'),
});

// PATCH /supplier-transactions/:transactionId/items/:stItemId — xác nhận nhận hàng (docs/api/api.md
// gap (i)). Giá trị tuyệt đối (không cộng dồn) — khớp cách FE gửi lại toàn bộ số đã nhận sau mỗi lần sửa.
export const receiveTransactionItemBodySchema = z.object({
  receivedQuantity: z.coerce.number().int().min(0, 'Số lượng đã nhận phải >= 0'),
});

export type SupplierIdParam = z.infer<typeof supplierIdParamSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
export type ListSupplierItemsQuery = z.infer<typeof listSupplierItemsQuerySchema>;
export type CreateSupplierBody = z.infer<typeof createSupplierBodySchema>;
export type UpdateSupplierBody = z.infer<typeof updateSupplierBodySchema>;
export type UpdateSupplierStatusBody = z.infer<typeof updateSupplierStatusBodySchema>;
export type AssignSupplierItemBody = z.infer<typeof assignSupplierItemBodySchema>;
export type UpdateSupplierItemBody = z.infer<typeof updateSupplierItemBodySchema>;
export type ListSupplierTransactionsQuery = z.infer<typeof listSupplierTransactionsQuerySchema>;
export type TransactionIdParam = z.infer<typeof transactionIdParamSchema>;
export type TransactionItemParam = z.infer<typeof transactionItemParamSchema>;
export type ReceiveTransactionItemBody = z.infer<typeof receiveTransactionItemBodySchema>;
export type SupplierItemParam = z.infer<typeof supplierItemParamSchema>;
export type CreateSupplierTransactionBody = z.infer<typeof createSupplierTransactionBodySchema>;
export type UpdateSupplierTransactionBody = z.infer<typeof updateSupplierTransactionBodySchema>;
export type UpdateSupplierTransactionStatusBody = z.infer<typeof updateSupplierTransactionStatusBodySchema>;
export type UpdateSupplierTransactionPaymentStatusBody = z.infer<typeof updateSupplierTransactionPaymentStatusBodySchema>;
