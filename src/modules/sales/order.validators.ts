import { z } from 'zod';

export const orderIdParamSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
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
  notes: z.string().trim().min(1).optional(),
});

export const createOrderBodySchema = z.object({
  customerId: z.string().trim().min(1, 'customerId is required'),
  quotationId: z.string().trim().min(1).nullable().optional(),
  eventType: z.string().trim().min(1, 'eventType is required'),
  eventName: z.string().trim().min(1).optional(),
  eventDate: z.coerce.date(),
  location: z.string().trim().min(1, 'location is required'),
  guestCount: z.coerce.number().int().nonnegative().optional(),
  items: z.array(orderItemInputSchema).min(1, 'items must contain at least 1 line'),
  notes: z.string().trim().min(1).optional(),
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

export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusBodySchema>;
export type UpdateOrderItemsBody = z.infer<typeof updateOrderItemsBodySchema>;
