import { z } from 'zod';

export const supplierIdParamSchema = z.object({
  id: z.string().trim().min(1, 'id is required'),
});

const activeStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const listSuppliersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: activeStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  // max cao hơn các list khác (docs/api/supplier_api.md mục 2) — UI hiện chưa có phân trang, FE có thể
  // gọi ?limit=200 để "hiện hết" trong lúc chưa dựng UI phân trang.
  limit: z.coerce.number().int().positive().max(200).default(20),
});

// Không nhận `email` dù model Supplier có cột này — đã chốt ở docs/api/supplier_api.md mục 1.3/5
// (createSupplierSchema thật không nhận field này, tránh gây hiểu nhầm là lưu được).
export const createSupplierBodySchema = z.object({
  supplierCode: z.string().trim().min(1, 'supplierCode is required'),
  supplierName: z.string().trim().min(1, 'supplierName is required'),
  serviceType: z.string().trim().min(1, 'serviceType is required'),
  phone: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  contactPerson: z.string().trim().min(1).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  notes: z.string().trim().min(1).optional(),
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
    notes: z.string().trim().min(1).optional(),
    status: activeStatusEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

const supplierTransactionStatusEnum = z.enum(['PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const listSupplierTransactionsQuerySchema = z.object({
  supplierId: z.string().trim().min(1).optional(),
  orderId: z.string().trim().min(1).optional(),
  status: supplierTransactionStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export type SupplierIdParam = z.infer<typeof supplierIdParamSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
export type CreateSupplierBody = z.infer<typeof createSupplierBodySchema>;
export type UpdateSupplierBody = z.infer<typeof updateSupplierBodySchema>;
export type ListSupplierTransactionsQuery = z.infer<typeof listSupplierTransactionsQuerySchema>;
