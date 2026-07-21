import type { DepositStatus, Item, OrderItemSource, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface LiveShowChecklist {
  backdrop: boolean;
  soundTest: boolean;
  powerBackup: boolean;
  operatorReady: boolean;
}

export const DEFAULT_LIVE_SHOW_CHECKLIST: LiveShowChecklist = {
  backdrop: false,
  soundTest: false,
  powerBackup: false,
  operatorReady: false,
};

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

const picklistInclude = {
  customer: { select: { customerName: true } },
  orderItems: { select: { quantity: true, preparedQty: true } },
  pickedUpByUser: { select: { fullName: true } },
} satisfies Prisma.OrderInclude;

export type OrderForPicklist = Prisma.OrderGetPayload<{ include: typeof picklistInclude }>;

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

  delete(orderId: string) {
    return prisma.order.delete({ where: { orderId } });
  },

  findLatestSurvey(orderId: string) {
    return prisma.surveyReport.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { reporter: { select: { fullName: true } }, confirmer: { select: { fullName: true } } },
    });
  },

  findDeposits(orderId: string) {
    return prisma.deposit.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  },

  createDeposit(data: {
    depositCode: string;
    orderId: string;
    amount: number;
    dueDate: Date | null;
    paymentMethod: string | null;
    qrCodeUrl: string | null;
    notes: string | null;
    requestedBy: string;
  }) {
    return prisma.deposit.create({ data });
  },

  async generateNextDepositCode(): Promise<string> {
    const count = await prisma.deposit.count();
    return `DEP-${String(count + 1).padStart(3, '0')}`;
  },

  sumDepositsByStatus(orderId: string, status: DepositStatus) {
    return prisma.deposit.aggregate({ where: { orderId, status }, _sum: { amount: true } });
  },

  findLatestSettlement(orderId: string) {
    return prisma.settlement.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  },

  createSettlement(data: {
    orderId: string;
    additionalFee: number;
    compensation: number;
    discount: number;
    finalAmount: number;
    paymentMethod: string | null;
    qrCodeUrl: string | null;
    notes: string | null;
    requestedBy: string;
  }) {
    return prisma.settlement.create({
      data: { ...data, status: 'DRAFT', requestedAt: new Date() },
    });
  },

  updateSettlementDraft(
    settlementId: string,
    data: {
      additionalFee: number;
      compensation: number;
      discount: number;
      finalAmount: number;
      paymentMethod: string | null;
      qrCodeUrl: string | null;
      notes: string | null;
      requestedBy: string;
    },
  ) {
    return prisma.settlement.update({
      where: { settlementId },
      data: { ...data, requestedAt: new Date() },
    });
  },

  findOrderItem(orderId: string, orderItemId: string) {
    return prisma.orderItem.findFirst({ where: { orderId, orderItemId } });
  },

  // Cập nhật 1 dòng order_item rồi tính lại orders.total_amount từ TOÀN BỘ dòng trong cùng transaction —
  // subtotal không phải cột generated trong DB thật (xem ghi chú đầu file), nên total_amount có thể lệch
  // nếu chỉ update dòng đơn lẻ mà không tính lại tổng.
  async updateItem(
    orderId: string,
    orderItemId: string,
    data: { quantity?: number; unitPrice?: number; source?: OrderItemSource; preparedQty?: number; notes?: string },
  ): Promise<OrderWithDetails> {
    const current = await prisma.orderItem.findUniqueOrThrow({ where: { orderItemId } });
    const quantity = data.quantity ?? current.quantity;
    const unitPrice = data.unitPrice ?? Number(current.unitPrice);
    const newSubtotal = quantity * unitPrice;

    const otherItems = await prisma.orderItem.findMany({
      where: { orderId, orderItemId: { not: orderItemId } },
      select: { subtotal: true },
    });
    const totalAmount = otherItems.reduce((sum, item) => sum + Number(item.subtotal), newSubtotal);

    const [, order] = await prisma.$transaction([
      prisma.orderItem.update({
        where: { orderItemId },
        data: {
          quantity,
          unitPrice,
          subtotal: newSubtotal,
          ...(data.source !== undefined ? { source: data.source } : {}),
          ...(data.preparedQty !== undefined ? { preparedQty: data.preparedQty } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      }),
      prisma.order.update({ where: { orderId }, data: { totalAmount }, include: detailInclude }),
    ]);

    return order;
  },

  async confirmPreparedQty(
    orderId: string,
    items: { orderItemId: string; preparedQty: number }[],
  ): Promise<OrderWithDetails> {
    await prisma.$transaction(
      items.map((line) =>
        prisma.orderItem.update({ where: { orderItemId: line.orderItemId }, data: { preparedQty: line.preparedQty } }),
      ),
    );
    const order = await prisma.order.findUnique({ where: { orderId }, include: detailInclude });
    if (!order) throw new Error('Order not found after confirm-prepared — should be unreachable');
    return order;
  },

  updateLiveChecklist(orderId: string, checklist: LiveShowChecklist): Promise<OrderWithDetails> {
    return prisma.order.update({
      where: { orderId },
      data: { liveShowChecklist: checklist as unknown as Prisma.InputJsonValue },
      include: detailInclude,
    });
  },

  updateQuotationId(orderId: string, quotationId: string | null): Promise<OrderWithDetails> {
    return prisma.order.update({ where: { orderId }, data: { quotationId }, include: detailInclude });
  },

  close(orderId: string, closedBy: string): Promise<OrderWithDetails> {
    return prisma.order.update({
      where: { orderId },
      data: { closedAt: new Date(), closedBy },
      include: detailInclude,
    });
  },

  markPickedUp(orderId: string, pickedUpBy: string): Promise<OrderForPicklist> {
    return prisma.order.update({
      where: { orderId },
      data: { pickedUpAt: new Date(), pickedUpBy },
      include: picklistInclude,
    });
  },

  // Xuất thiết bị v2 — reconcile theo báo giá (docs/api/xuatthietbi_tubaogia_api.md mục 4.1, bản
  // "CẬP NHẬT LẦN 2"): đồng bộ order_items theo quotation_items, rồi xuất bù/thu hồi phần chênh lệch
  // tồn kho so với movement đã ghi cho đơn — tất cả trong CÙNG 1 transaction, chạy lặp lại an toàn.
  // Prisma không expose SELECT...FOR UPDATE nên guard đồng thời bằng updateMany có điều kiện
  // `quantityAvailable >= delta` — count=0 nghĩa là 1 request khác vừa trừ kho trước, rollback toàn bộ.
  async exportEquipment(params: {
    orderId: string;
    performedBy: string;
    notes: string | null;
    quotationCode: string;
    targetLines: ExportEquipmentTargetLine[];
  }): Promise<ExportEquipmentResult> {
    const { orderId, performedBy, notes, quotationCode, targetLines } = params;

    // BUG mục 7 (docs/api/xuatthietbi_tubaogia_api.md): DB Aiven latency ~200ms/round-trip nên
    // transaction phải (a) nới timeout khỏi mặc định 5000ms, (b) gộp INSERT thành createMany và đọc
    // response cuối NGOÀI transaction để giảm số round-trip giữ transaction.
    const { movements, itemsChanged } = await prisma.$transaction(
      async (tx) => {
      // ── Bước 1: đồng bộ order_items theo quotation_items (đối chiếu theo itemId) ──
      const currentItems = await tx.orderItem.findMany({ where: { orderId } });
      const currentByItem = new Map(currentItems.map((line) => [line.itemId, line]));
      const targetByItem = new Map(targetLines.map((line) => [line.itemId, line]));

      let itemsChanged = false;

      const toDelete = currentItems.filter((line) => !targetByItem.has(line.itemId));
      if (toDelete.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderItemId: { in: toDelete.map((line) => line.orderItemId) } } });
        itemsChanged = true;
      }

      const toInsert = targetLines.filter((line) => !currentByItem.has(line.itemId));
      if (toInsert.length > 0) {
        await tx.orderItem.createMany({
          data: toInsert.map((line) => ({
            orderId,
            itemId: line.itemId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
            source: 'INTERNAL' as const,
            preparedQty: 0,
          })),
        });
        itemsChanged = true;
      }

      for (const line of targetLines) {
        const existing = currentByItem.get(line.itemId);
        if (!existing) {
          continue; // đã INSERT gộp ở trên
        }
        if (
          existing.quantity !== line.quantity ||
          Number(existing.unitPrice) !== line.unitPrice ||
          Number(existing.subtotal) !== line.subtotal
        ) {
          await tx.orderItem.update({
            where: { orderItemId: existing.orderItemId },
            data: {
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              subtotal: line.subtotal,
              // Không để "đã bàn giao" vượt số lượng mới khi báo giá giảm SL (mục 4.1 bước 1).
              preparedQty: Math.min(existing.preparedQty, line.quantity),
            },
          });
          itemsChanged = true;
        }
      }

      if (itemsChanged) {
        const totalAmount = targetLines.reduce((sum, line) => sum + line.subtotal, 0);
        await tx.order.update({ where: { orderId }, data: { totalAmount } });
      }

      // ── Bước 2: reconcile tồn kho theo delta = quantity đích − net đã xuất (OUTBOUND − INBOUND) ──
      // Đích chỉ tính cho dòng INTERNAL (giữ source cũ; dòng mới mặc định INTERNAL). Vòng lặp đi trên
      // hợp {item trong báo giá} ∪ {item có movement gắn đơn} để thu hồi cả item đã bị xóa khỏi báo giá.
      const internalTargetByItem = new Map(
        targetLines
          .filter((line) => (currentByItem.get(line.itemId)?.source ?? 'INTERNAL') === 'INTERNAL')
          .map((line) => [line.itemId, line.quantity]),
      );

      const movementAgg = await tx.inventoryMovement.groupBy({
        by: ['itemId', 'movementType'],
        where: { orderId },
        _sum: { quantity: true },
      });
      const netExportedByItem = new Map<string, number>();
      for (const row of movementAgg) {
        const signed =
          row.movementType === 'OUTBOUND'
            ? (row._sum.quantity ?? 0)
            : row.movementType === 'INBOUND'
              ? -(row._sum.quantity ?? 0)
              : 0;
        netExportedByItem.set(row.itemId, (netExportedByItem.get(row.itemId) ?? 0) + signed);
      }

      const unionItemIds = [...new Set([...internalTargetByItem.keys(), ...netExportedByItem.keys()])];

      const inventories = await tx.inventory.findMany({
        where: { itemId: { in: unionItemIds } },
        select: { itemId: true, quantityAvailable: true, quantityReserved: true },
      });
      const inventoryByItem = new Map(inventories.map((inv) => [inv.itemId, inv]));

      // Tên item cho movement/lỗi: ưu tiên snapshot itemName của báo giá, fallback catalog cho item
      // chỉ còn trong movement (đã bị xóa khỏi báo giá).
      const nameByItem = new Map(targetLines.map((line) => [line.itemId, line.itemName]));
      const unnamedIds = unionItemIds.filter((id) => !nameByItem.has(id));
      if (unnamedIds.length > 0) {
        const rows = await tx.item.findMany({ where: { itemId: { in: unnamedIds } }, select: { itemId: true, itemName: true } });
        for (const row of rows) nameByItem.set(row.itemId, row.itemName);
      }

      const insufficient: { itemId: string; itemName: string; required: number; available: number }[] = [];
      const movements: ExportEquipmentMovement[] = [];
      const movementRows: {
        itemId: string;
        orderId: string;
        movementType: 'OUTBOUND' | 'INBOUND';
        quantity: number;
        performedBy: string;
        notes: string;
      }[] = [];

      for (const itemId of unionItemIds) {
        const target = internalTargetByItem.get(itemId) ?? 0;
        const delta = target - (netExportedByItem.get(itemId) ?? 0);
        if (delta === 0) continue;

        const itemName = nameByItem.get(itemId) ?? itemId;

        if (delta > 0) {
          // Item chưa có dòng inventory coi như available = 0 — báo thiếu luôn thay vì lỗi update mù mờ.
          const available = inventoryByItem.get(itemId)?.quantityAvailable ?? 0;
          if (available < delta) {
            insufficient.push({ itemId, itemName, required: delta, available });
            continue;
          }
          const updated = await tx.inventory.updateMany({
            where: { itemId, quantityAvailable: { gte: delta } },
            data: { quantityAvailable: { decrement: delta }, quantityReserved: { increment: delta } },
          });
          if (updated.count === 0) {
            insufficient.push({ itemId, itemName, required: delta, available });
            continue;
          }
          movementRows.push({
            itemId,
            orderId,
            movementType: 'OUTBOUND',
            quantity: delta,
            performedBy,
            notes: notes
              ? `Xuất thiết bị theo báo giá ${quotationCode} — ${notes}`
              : `Xuất thiết bị theo báo giá ${quotationCode}`,
          });
          movements.push({ itemId, itemName, quantity: delta, movementType: 'OUTBOUND' });
        } else {
          const recall = -delta;
          // Clamp reserved về 0 — movement cũ có thể được ghi trước khi có cơ chế reserved theo đơn.
          const reservedDelta = Math.min(inventoryByItem.get(itemId)?.quantityReserved ?? 0, recall);
          await tx.inventory.updateMany({
            where: { itemId },
            data: { quantityAvailable: { increment: recall }, quantityReserved: { decrement: reservedDelta } },
          });
          movementRows.push({
            itemId,
            orderId,
            movementType: 'INBOUND',
            quantity: recall,
            performedBy,
            notes: `Thu hồi chênh lệch do đồng bộ báo giá ${quotationCode}`,
          });
          movements.push({ itemId, itemName, quantity: recall, movementType: 'INBOUND' });
        }
      }

      // Gom đủ danh sách thiếu rồi mới throw — FE nhận trọn các dòng thiếu trong 1 lần (mục 4.2).
      if (insufficient.length > 0) throw new InsufficientStockError(insufficient);

      // 1 createMany cho toàn bộ movement thay vì N create rời (BUG mục 7.2).
      if (movementRows.length > 0) {
        await tx.inventoryMovement.createMany({ data: movementRows });
      }

      // ── Bước 3: cờ mức đơn — chỉ ghi đè khi lần chạy này thật sự có movement (mục 4.1 bước 3) ──
      if (movements.length > 0) {
        await tx.order.update({
          where: { orderId },
          data: { pickedUpAt: new Date(), pickedUpBy: performedBy },
        });
      }

      return { movements, itemsChanged };
      },
      // DB Aiven ở xa (~200ms/round-trip): 5000ms mặc định vỡ ngay từ đơn 3 hạng mục (BUG mục 7.1).
      { timeout: 20000, maxWait: 5000 },
    );

    // Đọc response NGOÀI transaction — detailInclude nặng, chỉ phục vụ build response (BUG mục 7.2).
    const order = await prisma.order.findUnique({ where: { orderId }, include: detailInclude });
    if (!order) throw new Error('Order not found after export-equipment — should be unreachable');
    return { order, movements, itemsChanged };
  },
};

export interface ExportEquipmentTargetLine {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ExportEquipmentMovement {
  itemId: string;
  itemName: string;
  quantity: number;
  movementType: 'OUTBOUND' | 'INBOUND';
}

export interface ExportEquipmentResult {
  order: OrderWithDetails;
  movements: ExportEquipmentMovement[];
  itemsChanged: boolean;
}

export class InsufficientStockError extends Error {
  constructor(readonly items: { itemId: string; itemName: string; required: number; available: number }[]) {
    super('Tồn kho không đủ để xuất thiết bị');
  }
}

// ============================================================================
// Picklists (docs/api/picklistxuatkho_api.md) — luôn cố định orderStatus IN (CONFIRMED, IN_PROGRESS),
// không phải param client truyền vào (mục 2: "kho chỉ thật sự bị khóa sau khi xác nhận cọc").
export interface PicklistFilter {
  search?: string;
  exportStatus?: 'PENDING' | 'EXPORTED';
}

export interface PicklistParams extends PicklistFilter {
  skip: number;
  take: number;
}

function buildPicklistWhere(filter: PicklistFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { orderStatus: { in: ['CONFIRMED', 'IN_PROGRESS'] } };
  if (filter.search) {
    const q = filter.search;
    where.OR = [{ orderCode: { contains: q } }, { customer: { customerName: { contains: q } } }];
  }
  if (filter.exportStatus === 'PENDING') where.pickedUpAt = null;
  if (filter.exportStatus === 'EXPORTED') where.pickedUpAt = { not: null };
  return where;
}

export const orderPicklistRepository = {
  async findMany(params: PicklistParams) {
    const where = buildPicklistWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.order.findMany({ where, skip: params.skip, take: params.take, orderBy: { eventDate: 'asc' }, include: picklistInclude }),
      prisma.order.count({ where }),
    ]);
    return { rows, totalItems };
  },

  // Đếm trên TOÀN BỘ tập đã lọc theo search (không phân trang) — dùng cho meta.readyCount/exportedCount
  // (docs/api/picklistxuatkho_api.md mục 1/5.1). Quy mô nhỏ (theo ghi chú trong tài liệu, dữ liệu thật
  // hiện chỉ vài chục đơn CONFIRMED/IN_PROGRESS) nên tính trực tiếp ở tầng ứng dụng thay vì raw SQL.
  async findAllForCounts(search?: string) {
    const where = buildPicklistWhere({ search });
    return prisma.order.findMany({
      where,
      select: { orderId: true, pickedUpAt: true, orderItems: { select: { quantity: true, preparedQty: true } } },
    });
  },

  // Điều phối viên = LEAD của schedule_plans sớm nhất theo start_time (docs/api/picklistxuatkho_api.md
  // mục 3.4, đã chốt hướng (a)) — 1 truy vấn cho cả trang, group theo orderId ở tầng ứng dụng.
  async findLeadCoordinatorsByOrderIds(orderIds: string[]): Promise<Map<string, string>> {
    if (orderIds.length === 0) return new Map();
    const plans = await prisma.schedulePlan.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: { startTime: 'asc' },
      select: { orderId: true, assignees: { where: { role: 'LEAD' }, select: { user: { select: { fullName: true } } } } },
    });

    const result = new Map<string, string>();
    for (const plan of plans) {
      if (result.has(plan.orderId)) continue;
      const lead = plan.assignees[0];
      if (lead) result.set(plan.orderId, lead.user.fullName);
    }
    return result;
  },
};
