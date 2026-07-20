import type { Item, OrderItemSource, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface OrderLineInput {
  itemId: string;
  quantity: number;
  unitPrice: number;
  source?: OrderItemSource;
  notes?: string;
}

export interface OrderLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  source: OrderItemSource;
  notes: string | null;
}

export interface OrderListFilter {
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  customerId?: string;
}

export interface OrderListParams extends OrderListFilter {
  skip: number;
  take: number;
}

const detailInclude = {
  customer: { select: { customerName: true, phone: true, email: true, address: true } },
  creator: { select: { userId: true, fullName: true, role: true } },
  orderItems: { include: { item: { select: { itemName: true, unit: true } } } },
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

function buildWhere(filter: OrderListFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (filter.orderStatus) where.orderStatus = filter.orderStatus;
  if (filter.paymentStatus) where.paymentStatus = filter.paymentStatus;
  if (filter.customerId) where.customerId = filter.customerId;
  if (filter.search) {
    const q = filter.search;
    where.OR = [
      { orderCode: { contains: q } },
      { eventName: { contains: q } },
      { customer: { customerName: { contains: q } } },
      { customer: { phone: { contains: q } } },
    ];
  }
  return where;
}

// order_items.subtotal KHÔNG phải cột generated trong DB thật — repository PHẢI tính trước khi insert.
// OrderItem không có cột discount (khác QuotationItem) nên subtotal chỉ đơn thuần quantity * unitPrice.
export function computeOrderLines(inputs: OrderLineInput[]): OrderLine[] {
  return inputs.map((input) => ({
    itemId: input.itemId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    subtotal: input.quantity * input.unitPrice,
    source: input.source ?? 'INTERNAL',
    notes: input.notes ?? null,
  }));
}

export function computeOrderTotal(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.subtotal, 0);
}

export const orderRepository = {
  async findItemsByIds(itemIds: string[]): Promise<Item[]> {
    if (itemIds.length === 0) return [];
    return prisma.item.findMany({ where: { itemId: { in: itemIds } } });
  },

  async generateNextOrderCode(): Promise<string> {
    const count = await prisma.order.count();
    return `ORD-${String(count + 1).padStart(3, '0')}`;
  },

  async findMany(params: OrderListParams) {
    const where = buildWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { customerName: true, phone: true } } },
      }),
      prisma.order.count({ where }),
    ]);
    return { rows, totalItems };
  },

  // Giống Quotation — meta.counts là số liệu toàn bộ bảng, không bị ảnh hưởng bởi filter đang áp dụng.
  async countByStatusGlobal() {
    const [all, newCount, confirmed, inProgress, completed, cancelled] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { orderStatus: 'NEW' } }),
      prisma.order.count({ where: { orderStatus: 'CONFIRMED' } }),
      prisma.order.count({ where: { orderStatus: 'IN_PROGRESS' } }),
      prisma.order.count({ where: { orderStatus: 'COMPLETED' } }),
      prisma.order.count({ where: { orderStatus: 'CANCELLED' } }),
    ]);
    return { all, new: newCount, confirmed, inProgress, completed, cancelled };
  },

  findById(orderId: string): Promise<OrderWithDetails | null> {
    return prisma.order.findUnique({ where: { orderId }, include: detailInclude });
  },

  async create(params: {
    customerId: string;
    quotationId: string | null;
    orderCode: string;
    eventType: string;
    eventName: string | null;
    eventDate: Date;
    location: string;
    guestCount: number | null;
    notes: string | null;
    createdBy: string;
    itemInputs: OrderLineInput[];
  }): Promise<OrderWithDetails> {
    const lines = computeOrderLines(params.itemInputs);
    const totalAmount = computeOrderTotal(lines);

    return prisma.order.create({
      data: {
        orderCode: params.orderCode,
        customerId: params.customerId,
        quotationId: params.quotationId,
        eventType: params.eventType,
        eventName: params.eventName,
        eventDate: params.eventDate,
        location: params.location,
        guestCount: params.guestCount,
        notes: params.notes,
        createdBy: params.createdBy,
        totalAmount,
        orderItems: {
          create: lines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
            source: line.source,
            notes: line.notes,
          })),
        },
      },
      include: detailInclude,
    });
  },

  updateStatus(
    orderId: string,
    orderStatus: OrderStatus,
    cancelReason: string | null,
  ): Promise<OrderWithDetails> {
    return prisma.order.update({
      where: { orderId },
      data: { orderStatus, cancelReason },
      include: detailInclude,
    });
  },

  async replaceItems(orderId: string, itemInputs: OrderLineInput[]): Promise<OrderWithDetails> {
    const lines = computeOrderLines(itemInputs);
    const totalAmount = computeOrderTotal(lines);

    return prisma.order.update({
      where: { orderId },
      data: {
        totalAmount,
        orderItems: {
          deleteMany: {},
          create: lines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
            source: line.source,
            notes: line.notes,
          })),
        },
      },
      include: detailInclude,
    });
  },
};
