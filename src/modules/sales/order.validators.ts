import { z } from 'zod';

export const orderIdParamSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
});

export const orderItemIdParamSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
  orderItemId: z.string().trim().min(1, 'orderItemId is required'),
});

const orderStatusEnum = z.enum(['NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const paymentStatusEnum = z.enum(['UNPAID', 'DEPOSITED', 'PAID']);
const orderItemSourceEnum = z.enum(['INTERNAL', 'SUPPLIER']);

export const listOrdersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  orderStatus: orderStatusEnum.optional(),
  paymentStatus: paymentStatusEnum.optional(),
  customerId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const orderItemInputSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
  quantity: z.coerce.number().int().positive('quantity must be > 0'),
  unitPrice: z.coerce.number().nonnegative('unitPrice must be >= 0'),
  source: orderItemSourceEnum.default('INTERNAL'),
  notes: z.string().trim().optional(),
});

export const createOrderBodySchema = z.object({
  customerId: z.string().trim().min(1, 'customerId is required'),
  quotationId: z.string().trim().min(1).nullable().optional(),
  eventType: z.string().trim().min(1, 'eventType is required'),
  eventName: z.string().trim().min(1).optional(),
  eventDate: z.coerce.date(),
  location: z.string().trim().min(1, 'location is required'),
  guestCount: z.coerce.number().int().nonnegative().max(2_147_483_647, 'guestCount is too large').optional(),
  items: z.array(orderItemInputSchema).min(1, 'items must contain at least 1 line'),
  notes: z.string().trim().optional(),
});

export const updateOrderStatusBodySchema = z
  .object({
    orderStatus: orderStatusEnum,
    cancelReason: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.orderStatus !== 'CANCELLED' || !!data.cancelReason, {
    message: 'cancelReason is required when orderStatus is CANCELLED',
    path: ['cancelReason'],
  });

export const updateOrderItemsBodySchema = z.object({
  items: z.array(orderItemInputSchema).min(1, 'items must contain at least 1 line'),
});

// PATCH /orders/:orderId/items/:orderItemId — sửa 1 dòng đơn lẻ (khác PUT .../items thay toàn bộ mảng).
export const updateOrderItemBodySchema = z
  .object({
    quantity: z.coerce.number().int().positive('quantity must be > 0').optional(),
    unitPrice: z.coerce.number().nonnegative('unitPrice must be >= 0').optional(),
    source: orderItemSourceEnum.optional(),
    preparedQty: z.coerce.number().int().nonnegative().optional(),
    notes: z.string().trim().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

// Checklist Live Show (Mốc 4) — đã chốt hướng A ở docs/api/tiendosukien_api.md mục 5: nhận { key, checked }.
export const liveChecklistKeyEnum = z.enum(['backdrop', 'soundTest', 'powerBackup', 'operatorReady']);

export const updateLiveChecklistBodySchema = z.object({
  key: liveChecklistKeyEnum,
  checked: z.boolean(),
});

// PATCH /orders/:orderId/quotation — liên kết/hủy liên kết báo giá (docs/api/baogiavahopdong_api.md mục 2 #4).
export const updateOrderQuotationBodySchema = z.object({
  quotationId: z.string().trim().min(1).nullable(),
});

export const closeOrderBodySchema = z.object({
  notes: z.string().trim().optional(),
});

export const exportEquipmentBodySchema = z.object({
  notes: z.string().trim().optional(),
});

const confirmPreparedItemSchema = z.object({
  orderItemId: z.string().trim().min(1, 'orderItemId is required'),
  preparedQty: z.coerce.number().int().nonnegative('preparedQty must be >= 0'),
});

export const confirmPreparedItemsBodySchema = z.object({
  items: z.array(confirmPreparedItemSchema).min(1, 'items must contain at least 1 line'),
});

export const createDepositBodySchema = z.object({
  amount: z.coerce.number().positive('amount must be > 0'),
  dueDate: z.coerce.date().optional(),
  paymentMethod: z.string().trim().min(1).optional(),
  qrCodeUrl: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
});

export const createSettlementBodySchema = z.object({
  additionalFee: z.coerce.number().nonnegative().default(0),
  compensation: z.coerce.number().nonnegative().default(0),
  discount: z.coerce.number().nonnegative().default(0),
  paymentMethod: z.string().trim().min(1).optional(),
  qrCodeUrl: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
});

const exportStatusEnum = z.enum(['PENDING', 'EXPORTED']);

export const listPicklistsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  exportStatus: exportStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListPicklistsQuery = z.infer<typeof listPicklistsQuerySchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type OrderItemIdParam = z.infer<typeof orderItemIdParamSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusBodySchema>;
export type UpdateOrderItemsBody = z.infer<typeof updateOrderItemsBodySchema>;
export type UpdateOrderItemBody = z.infer<typeof updateOrderItemBodySchema>;
export type UpdateLiveChecklistBody = z.infer<typeof updateLiveChecklistBodySchema>;
export type UpdateOrderQuotationBody = z.infer<typeof updateOrderQuotationBodySchema>;
export type CloseOrderBody = z.infer<typeof closeOrderBodySchema>;
export type ExportEquipmentBody = z.infer<typeof exportEquipmentBodySchema>;
export type ConfirmPreparedItemsBody = z.infer<typeof confirmPreparedItemsBodySchema>;
export type CreateDepositBody = z.infer<typeof createDepositBodySchema>;
export type CreateSettlementBody = z.infer<typeof createSettlementBodySchema>;
