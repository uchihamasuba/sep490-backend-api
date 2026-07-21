import type {
  CollectedEquipmentReportStatus,
  CollectedEquipmentReportType,
  InventoryMovementType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../db/prisma';

const inventoryItemInclude = {
  item: {
    select: {
      itemName: true,
      itemCode: true,
      unit: true,
      rentalPrice: true,
      purchasePrice: true,
      type: { select: { typeName: true, category: { select: { categoryName: true } } } },
    },
  },
} satisfies Prisma.InventoryInclude;

export type InventoryWithItem = Prisma.InventoryGetPayload<{ include: typeof inventoryItemInclude }>;

const movementInclude = {
  item: { select: { itemName: true, unit: true } },
  performer: { select: { userId: true, fullName: true } },
} satisfies Prisma.InventoryMovementInclude;

export type MovementWithDetails = Prisma.InventoryMovementGetPayload<{ include: typeof movementInclude }>;

const reportInclude = {
  order: { select: { orderCode: true } },
  reporter: { select: { userId: true, fullName: true } },
  confirmer: { select: { userId: true, fullName: true } },
  items: { include: { item: { select: { itemName: true, unit: true } } } },
} satisfies Prisma.CollectedEquipmentReportInclude;

export type ReportWithDetails = Prisma.CollectedEquipmentReportGetPayload<{ include: typeof reportInclude }>;

export interface InventoryListFilter {
  itemId?: string;
  search?: string;
}

export interface MovementListFilter {
  itemId?: string;
  orderId?: string;
  movementType?: InventoryMovementType;
}

export interface ReportListFilter {
  status?: CollectedEquipmentReportStatus;
  orderId?: string;
}

function buildInventoryWhere(filter: InventoryListFilter): Prisma.InventoryWhereInput {
  const where: Prisma.InventoryWhereInput = {};
  if (filter.itemId) where.itemId = filter.itemId;
  if (filter.search) where.item = { itemName: { contains: filter.search } };
  return where;
}

export const inventoryRepository = {
  async findMany(filter: InventoryListFilter, skip: number, take: number) {
    const where = buildInventoryWhere(filter);
    const [rows, totalItems] = await Promise.all([
      prisma.inventory.findMany({ where, skip, take, include: inventoryItemInclude, orderBy: { updatedAt: 'desc' } }),
      prisma.inventory.count({ where }),
    ]);
    return { rows, totalItems };
  },

  findByItemId(itemId: string): Promise<InventoryWithItem | null> {
    return prisma.inventory.findUnique({ where: { itemId }, include: inventoryItemInclude });
  },

  itemExists(itemId: string) {
    return prisma.item.findUnique({ where: { itemId }, select: { itemId: true, itemName: true } });
  },

  create(data: { itemId: string; quantityTotal: number; quantityDamaged: number; quantityAvailable: number }): Promise<InventoryWithItem> {
    return prisma.inventory.create({
      data: { itemId: data.itemId, quantityTotal: data.quantityTotal, quantityDamaged: data.quantityDamaged, quantityReserved: 0, quantityAvailable: data.quantityAvailable },
      include: inventoryItemInclude,
    });
  },

  orderExists(orderId: string) {
    return prisma.order.findUnique({ where: { orderId }, select: { orderId: true } });
  },

  reportExists(reportId: string) {
    return prisma.collectedEquipmentReport.findUnique({ where: { reportId }, select: { reportId: true } });
  },

  // reserve/release/adjust dùng increment/decrement nguyên tử của Prisma thay vì đọc-rồi-ghi thủ công —
  // an toàn hơn dưới điều kiện ghi đồng thời. Service đã validate điều kiện (available/reserved đủ) từ
  // bản đọc gần nhất trước khi gọi các hàm này.
  reserve(itemId: string, quantity: number): Promise<InventoryWithItem> {
    return prisma.inventory.update({
      where: { itemId },
      data: { quantityAvailable: { decrement: quantity }, quantityReserved: { increment: quantity } },
      include: inventoryItemInclude,
    });
  },

  release(itemId: string, quantity: number): Promise<InventoryWithItem> {
    return prisma.inventory.update({
      where: { itemId },
      data: { quantityReserved: { decrement: quantity }, quantityAvailable: { increment: quantity } },
      include: inventoryItemInclude,
    });
  },

  adjustTotal(itemId: string, deltaTotal: number): Promise<InventoryWithItem> {
    return prisma.inventory.update({
      where: { itemId },
      data: { quantityTotal: { increment: deltaTotal }, quantityAvailable: { increment: deltaTotal } },
      include: inventoryItemInclude,
    });
  },

  createMovement(data: {
    itemId: string;
    orderId: string | null;
    reportId: string | null;
    movementType: InventoryMovementType;
    quantity: number;
    performedBy: string;
    notes: string | null;
  }) {
    return prisma.inventoryMovement.create({ data });
  },

  async findMovements(filter: MovementListFilter, skip: number, take: number) {
    const where: Prisma.InventoryMovementWhereInput = {};
    if (filter.itemId) where.itemId = filter.itemId;
    if (filter.orderId) where.orderId = filter.orderId;
    if (filter.movementType) where.movementType = filter.movementType;

    const [rows, totalItems] = await Promise.all([
      prisma.inventoryMovement.findMany({ where, skip, take, include: movementInclude, orderBy: { createdAt: 'desc' } }),
      prisma.inventoryMovement.count({ where }),
    ]);
    return { rows, totalItems };
  },

  findOrderItemsForPicklist(orderId: string) {
    return prisma.orderItem.findMany({
      where: { orderId },
      include: {
        item: { select: { itemName: true, unit: true, inventory: { select: { quantityAvailable: true } } } },
      },
    });
  },

  async findReports(filter: ReportListFilter, skip: number, take: number) {
    const where: Prisma.CollectedEquipmentReportWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.orderId) where.orderId = filter.orderId;

    const [rows, totalItems] = await Promise.all([
      prisma.collectedEquipmentReport.findMany({ where, skip, take, include: reportInclude, orderBy: { createdAt: 'desc' } }),
      prisma.collectedEquipmentReport.count({ where }),
    ]);
    return { rows, totalItems };
  },

  findReportById(reportId: string): Promise<ReportWithDetails | null> {
    return prisma.collectedEquipmentReport.findUnique({ where: { reportId }, include: reportInclude });
  },

  createReport(data: {
    orderId: string;
    reportType: CollectedEquipmentReportType;
    transactionId: string | null;
    reportedBy: string;
    notes: string | null;
    items: { itemId: string; goodQuantity: number; damagedQuantity: number; lostQuantity: number; notes: string | null }[];
  }): Promise<ReportWithDetails> {
    return prisma.collectedEquipmentReport.create({
      data: {
        orderId: data.orderId,
        reportType: data.reportType,
        transactionId: data.transactionId,
        reportedBy: data.reportedBy,
        notes: data.notes,
        items: { create: data.items },
      },
      include: reportInclude,
    });
  },

  // Xác nhận báo cáo + áp dụng hiệu ứng tồn kho (available += good, damaged += damaged, total -= lost,
  // reserved -= toàn bộ số về) + ghi 1 dòng inventory_movements(INBOUND)/item trong CÙNG 1 transaction —
  // đảm bảo không có trạng thái "đã confirm report nhưng chưa cập nhật tồn kho" nếu 1 bước giữa chừng lỗi.
  async confirmReportAndApplyInventory(
    reportId: string,
    orderId: string,
    confirmedBy: string,
    items: { itemId: string; goodQuantity: number; damagedQuantity: number; lostQuantity: number }[],
  ): Promise<ReportWithDetails> {
    await prisma.$transaction(async (tx) => {
      await tx.collectedEquipmentReport.update({
        where: { reportId },
        data: { status: 'CONFIRMED', confirmedBy, confirmedAt: new Date() },
      });

      for (const line of items) {
        // Hoàn lại phần "đang giữ cho đơn" đã cộng lúc xuất thiết bị (OUTBOUND — xem
        // order.repository.ts#exportEquipment): mọi thiết bị về (tốt/hỏng/mất) đều rời trạng thái
        // reserved. Clamp về 0 vì có biên bản thu hồi cho đơn chưa từng đi qua luồng export
        // (dữ liệu trước khi có endpoint, hoặc reserve thủ công không theo đơn).
        const inv = await tx.inventory.findUnique({
          where: { itemId: line.itemId },
          select: { quantityReserved: true },
        });
        const returnedTotal = line.goodQuantity + line.damagedQuantity + line.lostQuantity;
        const reservedDelta = Math.min(inv?.quantityReserved ?? 0, returnedTotal);
        await tx.inventory.update({
          where: { itemId: line.itemId },
          data: {
            quantityAvailable: { increment: line.goodQuantity },
            quantityDamaged: { increment: line.damagedQuantity },
            quantityTotal: { decrement: line.lostQuantity },
            quantityReserved: { decrement: reservedDelta },
          },
        });
      }

      // Set order_id (trước đây NULL) để công thức net_exported của export-equipment v2 phản ánh
      // "đồ đã về kho thì được phép xuất lại" — docs/api/xuatthietbi_tubaogia_api.md mục 4.1 bước 2.1.
      const movementLines = items.filter((line) => line.goodQuantity + line.damagedQuantity > 0);
      if (movementLines.length > 0) {
        await tx.inventoryMovement.createMany({
          data: movementLines.map((line) => ({
            itemId: line.itemId,
            reportId,
            orderId,
            movementType: 'INBOUND' as const,
            quantity: line.goodQuantity + line.damagedQuantity,
            performedBy: confirmedBy,
            notes: 'Nhập kho từ biên bản thu hồi thiết bị',
          })),
        });
      }
    });

    const report = await prisma.collectedEquipmentReport.findUnique({ where: { reportId }, include: reportInclude });
    if (!report) throw new Error('Report not found after confirm — should be unreachable');
    return report;
  },
};
