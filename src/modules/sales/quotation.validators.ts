import { z } from 'zod';

export const quotationIdParamSchema = z.object({
  quotationId: z.string().trim().min(1, 'Thiếu mã báo giá'),
});

export const customerIdParamSchema = z.object({
  customerId: z.string().trim().min(1, 'Thiếu mã khách hàng'),
});

const quotationApiStatusEnum = z.enum(['draft', 'approved', 'rejected']);

export const listQuotationsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: quotationApiStatusEnum.optional(),
  customerId: z.string().trim().min(1).optional(),
  isManagerViewed: z.preprocess((val) => val === 'true', z.boolean()).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const listCustomerQuotationsQuerySchema = z.object({
  status: quotationApiStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const quotationItemInputSchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
  quantity: z.coerce.number().int().positive('Số lượng phải lớn hơn 0'),
  price: z.coerce.number().nonnegative('Đơn giá phải >= 0'),
  discount: z.coerce.number().nonnegative('Giảm giá phải >= 0').default(0),
});

export const createQuotationBodySchema = z.object({
  version: z.string().trim().min(1, 'Vui lòng nhập phiên bản báo giá').default('v1'),
  notes: z.string().trim().optional(),
  items: z.array(quotationItemInputSchema).min(1, 'Danh sách thiết bị phải có ít nhất 1 dòng'),
});

export const updateQuotationBodySchema = z.object({
  version: z.string().trim().min(1, 'Vui lòng nhập phiên bản báo giá'),
  notes: z.string().trim().optional(),
  items: z.array(quotationItemInputSchema).min(1, 'Danh sách thiết bị phải có ít nhất 1 dòng'),
});

export const updateQuotationStatusBodySchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export type QuotationIdParam = z.infer<typeof quotationIdParamSchema>;
export type CustomerIdParam = z.infer<typeof customerIdParamSchema>;
export type ListQuotationsQuery = z.infer<typeof listQuotationsQuerySchema>;
export type ListCustomerQuotationsQuery = z.infer<typeof listCustomerQuotationsQuerySchema>;
export type QuotationItemInput = z.infer<typeof quotationItemInputSchema>;
export type CreateQuotationBody = z.infer<typeof createQuotationBodySchema>;
export type UpdateQuotationBody = z.infer<typeof updateQuotationBodySchema>;
export type UpdateQuotationStatusBody = z.infer<typeof updateQuotationStatusBodySchema>;
