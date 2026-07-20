import type { OrderStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { customerRepository } from './customer.repository';
import { quotationRepository } from './quotation.repository';
import { orderRepository, type OrderLineInput, type OrderWithDetails } from './order.repository';
import type { CreateOrderBody, ListOrdersQuery, UpdateOrderStatusBody } from './order.validators';

const TERMINAL_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED'];

export interface OrderListItemDTO {
  orderId: string;
  orderCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  eventType: string;
  eventName: string | null;
  eventDate: string;
  location: string;
  guestCount: number | null;
  totalAmount: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
}

export interface OrderItemDTO {
  orderItemId: string;
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  source: string;
  preparedQty: number;
  notes: string | null;
}

export interface OrderDetailDTO extends OrderListItemDTO {
  customerEmail: string;
  customerAddress: string | null;
  quotationId: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdBy: { userId: string; fullName: string; role: string };
  updatedAt: string;
  items: OrderItemDTO[];
}

export interface OrderListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  counts: { all: number; new: number; confirmed: number; inProgress: number; completed: number; cancelled: number };
}

export interface CreateOrderResult {
  orderId: string;
  orderCode: string;
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function mapListItem(row: {
  orderId: string;
  orderCode: string;
  customerId: string;
  eventType: string;
  eventName: string | null;
  eventDate: Date;
  location: string;
  guestCount: number | null;
  totalAmount: unknown;
  paymentStatus: string;
  orderStatus: string;
  createdAt: Date;
  customer: { customerName: string; phone: string };
}): OrderListItemDTO {
  return {
    orderId: row.orderId,
    orderCode: row.orderCode,
    customerId: row.customerId,
    customerName: row.customer.customerName,
    customerPhone: row.customer.phone,
    eventType: row.eventType,
    eventName: row.eventName,
    eventDate: row.eventDate.toISOString(),
    location: row.location,
    guestCount: row.guestCount,
    totalAmount: toNumber(row.totalAmount),
    paymentStatus: row.paymentStatus,
    orderStatus: row.orderStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapDetail(row: OrderWithDetails): OrderDetailDTO {
  return {
    ...mapListItem(row),
    customerEmail: row.customer.email ?? '',
    customerAddress: row.customer.address,
    quotationId: row.quotationId,
    cancelReason: row.cancelReason,
    notes: row.notes,
    createdBy: { userId: row.creator.userId, fullName: row.creator.fullName, role: row.creator.role },
    updatedAt: row.updatedAt.toISOString(),
    items: row.orderItems.map((item) => ({
      orderItemId: item.orderItemId,
      itemId: item.itemId,
      itemName: item.item.itemName,
      unit: item.item.unit,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      subtotal: toNumber(item.subtotal),
      source: item.source,
      preparedQty: item.preparedQty,
      notes: item.notes,
    })),
  };
}

async function validateItemsExist(items: OrderLineInput[]): Promise<void> {
  const uniqueItemIds = Array.from(new Set(items.map((line) => line.itemId)));
  const foundItems = await orderRepository.findItemsByIds(uniqueItemIds);
  const foundIds = new Set(foundItems.map((item) => item.itemId));
  const missingIds = uniqueItemIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    throw AppError.badRequest('Một hoặc nhiều hạng mục không tồn tại trong catalog', { itemIds: missingIds });
  }
}

async function findOrderOrThrow(orderId: string): Promise<OrderWithDetails> {
  const order = await orderRepository.findById(orderId);
  if (!order) throw AppError.notFound('Order not found');
  return order;
}

function assertNotTerminal(order: OrderWithDetails): void {
  if (TERMINAL_STATUSES.includes(order.orderStatus)) {
    throw AppError.badRequest(
      `Đơn hàng đang ở trạng thái ${order.orderStatus} (đã kết thúc), không thể cập nhật thêm`,
    );
  }
}

async function listOrders(query: ListOrdersQuery): Promise<{ data: OrderListItemDTO[]; meta: OrderListMeta }> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [{ rows, totalItems }, counts] = await Promise.all([
    orderRepository.findMany({
      orderStatus: query.orderStatus,
      paymentStatus: query.paymentStatus,
      search: query.search,
      customerId: query.customerId,
      skip,
      take: limit,
    }),
    orderRepository.countByStatusGlobal(),
  ]);

  return {
    data: rows.map(mapListItem),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit), counts },
  };
}

async function getOrderById(orderId: string): Promise<OrderDetailDTO> {
  const order = await findOrderOrThrow(orderId);
  return mapDetail(order);
}

async function createOrder(body: CreateOrderBody, createdByUserId: string): Promise<CreateOrderResult> {
  const customer = await customerRepository.findById(body.customerId);
  if (!customer) throw AppError.notFound('Customer not found');

  if (body.quotationId) {
    const quotation = await quotationRepository.findById(body.quotationId);
    if (!quotation) throw AppError.notFound('Quotation not found');
  }

  await validateItemsExist(body.items);

  const orderCode = await orderRepository.generateNextOrderCode();
  const created = await orderRepository.create({
    customerId: body.customerId,
    quotationId: body.quotationId ?? null,
    orderCode,
    eventType: body.eventType,
    eventName: body.eventName ?? null,
    eventDate: body.eventDate,
    location: body.location,
    guestCount: body.guestCount ?? null,
    notes: body.notes ?? null,
    createdBy: createdByUserId,
    itemInputs: body.items,
  });

  return { orderId: created.orderId, orderCode: created.orderCode };
}

async function updateOrderStatus(orderId: string, body: UpdateOrderStatusBody): Promise<OrderDetailDTO> {
  const existing = await findOrderOrThrow(orderId);
  assertNotTerminal(existing);

  const cancelReason = body.orderStatus === 'CANCELLED' ? (body.cancelReason ?? null) : null;
  const updated = await orderRepository.updateStatus(orderId, body.orderStatus, cancelReason);
  return mapDetail(updated);
}

async function updateOrderItems(orderId: string, items: OrderLineInput[]): Promise<OrderDetailDTO> {
  const existing = await findOrderOrThrow(orderId);
  assertNotTerminal(existing);

  await validateItemsExist(items);
  const updated = await orderRepository.replaceItems(orderId, items);
  return mapDetail(updated);
}

export const orderService = {
  listOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateOrderItems,
};
