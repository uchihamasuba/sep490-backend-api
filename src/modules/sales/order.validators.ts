import { z } from 'zod';

export const orderIdParamSchema = z.object({
  orderId: z.string().trim().min(1, 'Thiếu mã đơn hàng'),
});

export const orderItemIdParamSchema = z.object({
  orderId: z.string().trim().min(1, 'Thiếu mã đơn hàng'),
  orderItemId: z.string().trim().min(1, 'Thiếu mã dòng hàng'),
});

const orderStatusEnum = z.enum(['NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
  message: 'orderStatus không hợp lệ',
});
const paymentStatusEnum = z.enum(['UNPAID', 'DEPOSITED', 'PAID'], { message: 'paymentStatus không hợp lệ' });
const orderItemSourceEnum = z.enum(['INTERNAL', 'SUPPLIER'], { message: 'source không hợp lệ, chỉ chấp nhận INTERNAL hoặc SUPPLIER' });

export const listOrdersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  orderStatus: orderStatusEnum.optional(),
  paymentStatus: paymentStatusEnum.optional(),
  customerId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const listOrderDepositsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const orderItemInputSchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
  quantity: z.coerce.number().int().positive('Số lượng phải lớn hơn 0'),
  unitPrice: z.coerce.number().nonnegative('Đơn giá phải >= 0'),
  source: orderItemSourceEnum.default('INTERNAL'),
  notes: z.string().trim().optional(),
});

export const createOrderBodySchema = z.object({
  customerId: z.string().trim().min(1, 'Thiếu mã khách hàng'),
  quotationId: z.string().trim().min(1).nullable().optional(),
  eventType: z.string().trim().min(1, 'Vui lòng nhập loại sự kiện'),
  eventName: z.string().trim().min(1).optional(),
  eventDate: z.coerce.date(),
  location: z.string().trim().min(1, 'Vui lòng nhập địa điểm'),
  guestCount: z.coerce.number().int().nonnegative().max(2_147_483_647, 'Số lượng khách quá lớn').optional(),
  items: z.array(orderItemInputSchema).default([]),
  notes: z.string().trim().optional(),
});

export const updateOrderStatusBodySchema = z
  .object({
    orderStatus: orderStatusEnum,
    cancelReason: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.orderStatus !== 'CANCELLED' || !!data.cancelReason, {
    message: 'Vui lòng nhập lý do khi hủy đơn hàng',
    path: ['cancelReason'],
  });

export const updateOrderItemsBodySchema = z.object({
  items: z.array(orderItemInputSchema).min(1, 'Danh sách thiết bị phải có ít nhất 1 dòng'),
});

// PATCH /orders/:orderId/items/:orderItemId — sửa 1 dòng đơn lẻ (khác PUT .../items thay toàn bộ mảng).
export const updateOrderItemBodySchema = z
  .object({
    quantity: z.coerce.number().int().positive('Số lượng phải lớn hơn 0').optional(),
    unitPrice: z.coerce.number().nonnegative('Đơn giá phải >= 0').optional(),
    source: orderItemSourceEnum.optional(),
    preparedQty: z.coerce.number().int().nonnegative().optional(),
    notes: z.string().trim().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Vui lòng cung cấp ít nhất một trường thông tin',
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
  force: z.boolean().optional(),
});

const confirmPreparedItemSchema = z.object({
  orderItemId: z.string().trim().min(1, 'Thiếu mã dòng hàng'),
  preparedQty: z.coerce.number().int().nonnegative('Số lượng đã chuẩn bị phải >= 0'),
});

export const confirmPreparedItemsBodySchema = z.object({
  items: z.array(confirmPreparedItemSchema).min(1, 'Danh sách thiết bị phải có ít nhất 1 dòng'),
});

export const createDepositBodySchema = z.object({
  amount: z.coerce.number().positive('Số tiền phải lớn hơn 0'),
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

const changeRequestTypeEnum = z.enum(['add', 'remove', 'replace'], { message: 'type không hợp lệ' });
const changeRequestItemActionEnum = z.enum(['add', 'remove'], { message: 'action không hợp lệ' });

const changeRequestItemInputSchema = z.object({
  catalogItemId: z.string().trim().min(1, 'Thiếu mã hạng mục'),
  quantity: z.coerce.number().int().positive('Số lượng phải lớn hơn 0'),
  action: changeRequestItemActionEnum,
});

// POST /orders/:orderId/change-requests — Leader báo thêm/bớt/đổi thiết bị tại hiện trường. `type`
// quyết định action hợp lệ của từng dòng items: add/remove chỉ chứa toàn action cùng tên, replace cần
// đúng 1 dòng remove (đồ cũ) + 1 dòng add (đồ mới).
export const createChangeRequestBodySchema = z
  .object({
    type: changeRequestTypeEnum,
    items: z.array(changeRequestItemInputSchema).min(1, 'Phải có ít nhất 1 dòng thiết bị'),
  })
  .refine(
    (body) => {
      if (body.type === 'add') return body.items.every((item) => item.action === 'add');
      if (body.type === 'remove') return body.items.every((item) => item.action === 'remove');
      return (
        body.items.length === 2 &&
        body.items.filter((item) => item.action === 'add').length === 1 &&
        body.items.filter((item) => item.action === 'remove').length === 1
      );
    },
    {
      message: 'items không khớp với type (add/remove cần cùng action; replace cần đúng 1 add + 1 remove)',
      path: ['items'],
    },
  );

const exportStatusEnum = z.enum(['PENDING', 'EXPORTED'], { message: 'exportStatus không hợp lệ' });

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
export type ListOrderDepositsQuery = z.infer<typeof listOrderDepositsQuerySchema>;
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
export type CreateChangeRequestBody = z.infer<typeof createChangeRequestBodySchema>;
