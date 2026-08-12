import type {
  CollectedEquipmentReportStatus,
  CollectedEquipmentReportType,
  InventoryMovementType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/AppError';
import { reservationRepository } from './reservation.repository';

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
  evidences: { select: { evidenceId: true } },
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
  reportType?: CollectedEquipmentReportType;
  transactionId?: string;
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

  /** Tổng/hỏng của nhiều item cùng lúc (cho timeline thiết bị — tính capacity/over-committed). */
  findManyByItemIds(itemIds: string[]): Promise<{ itemId: string; quantityTotal: number; quantityDamaged: number }[]> {
    if (itemIds.length === 0) return Promise.resolve([]);
    return prisma.inventory.findMany({
      where: { itemId: { in: itemIds } },
      select: { itemId: true, quantityTotal: true, quantityDamaged: true },
    });
  },

  itemExists(itemId: string) {
    return prisma.item.findUnique({ where: { itemId }, select: { itemId: true, itemName: true } });
  },

  create(data: { itemId: string; quantityTotal: number; quantityDamaged: number }): Promise<InventoryWithItem> {
    return prisma.inventory.create({
      data: { itemId: data.itemId, quantityTotal: data.quantityTotal, quantityDamaged: data.quantityDamaged },
      include: inventoryItemInclude,
    });
  },

  orderExists(orderId: string) {
    return prisma.order.findUnique({ where: { orderId }, select: { orderId: true } });
  },

  reportExists(reportId: string) {
    return prisma.collectedEquipmentReport.findUnique({ where: { reportId }, select: { reportId: true } });
  },

  async getLockedQuantityByDate(itemId: string, date: Date): Promise<number> {
    // Bỏ điều kiện `pickedUpAt: null` (2026-08-03, theo yêu cầu người dùng): trước đây coi đơn đã "xuất
    // thiết bị" là hết cần khóa, đúng NẾU xuất kho có trừ thật `inventory` — nhưng POST
    // /orders/:id/export-equipment đã đổi qua chỉ đồng bộ order_items, KHÔNG còn trừ tồn kho thật (xem
    // docs/xuatthietbi_tubaogia_api.md mục 8). Giữ nguyên `pickedUpAt: null` sẽ khiến thiết bị của đơn đã
    // xuất "biến mất" khỏi cả 2 phía (không tính là khóa, cũng không bị trừ khỏi tổng) trong suốt thời
    // gian đơn còn IN_PROGRESS — vẫn phải tính là khóa cho tới khi đơn rời khỏi CONFIRMED/IN_PROGRESS.
    const orders = await prisma.order.findMany({
      where: {
        orderStatus: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        orderItems: { some: { itemId, source: 'INTERNAL' } },
      },
      select: {
        orderId: true,
        eventDate: true,
        endDate: true,
        createdAt: true,
        confirmedAt: true,
        orderItems: { where: { itemId, source: 'INTERNAL' }, select: { quantity: true } },
        // Chỉ lấy lịch trình THẬT SỰ giữ thiết bị (SETUP = lắp đặt, COLLECT = thu hồi) để tính khung giờ
        // khóa/nhả kho — loại SURVEY (khảo sát hiện trường) ra vì buổi khảo sát không mang thiết bị đi,
        // nếu tính cả SURVEY thì khung khóa sẽ kéo lùi về tận ngày khảo sát (có thể trước ngày tổ chức
        // hàng tuần), khóa oan thiết bị suốt khoảng thời gian không hề dùng tới. Cũng loại lịch trình đã
        // CANCELLED — kế hoạch bị hủy không còn giữ chỗ thiết bị.
        schedulePlans: {
          where: { status: { not: 'CANCELLED' }, task: { taskCode: { in: ['SETUP', 'COLLECT'] } } },
          select: { startTime: true, endTime: true },
        },
      }
    });

    if (orders.length === 0) return 0;

    // Phần nhu cầu của đơn đã có giao dịch thuê Nhà cung cấp (chưa hủy) cho đúng item này — không tính
    // vào "đã khóa" của kho nội bộ, vì phần đó được cung ứng từ bên ngoài, không lấy từ kho nội bộ. Nếu
    // không trừ phần này, 1 đơn có `order_items.quantity` lớn hơn nhiều tồn kho thật (vì phần lớn đã
    // thuê bù NCC) sẽ khiến "đã khóa" vượt xa tổng tồn kho, kéo "khả dụng" xuống âm sai lệch.
    const supplierCoveredRows = await prisma.supplierTransactionItem.findMany({
      where: {
        itemId,
        transaction: { orderId: { in: orders.map((o) => o.orderId) }, status: { not: 'CANCELLED' } },
      },
      select: { quantity: true, transaction: { select: { orderId: true } } },
    });
    const supplierCoveredByOrder = new Map<string, number>();
    for (const row of supplierCoveredRows) {
      const orderId = row.transaction.orderId;
      if (!orderId) continue;
      supplierCoveredByOrder.set(orderId, (supplierCoveredByOrder.get(orderId) ?? 0) + row.quantity);
    }

    const queryTime = date.getTime();
    const nextDayTime = queryTime + 24 * 60 * 60 * 1000;

    let totalLocked = 0;
    for (const order of orders) {
      let lockStartTime = 0;
      let lockEndTime = Infinity;
      
      const startCandidates: number[] = [order.eventDate.getTime()];
      const endCandidates: number[] = [];
      
      if (order.endDate) endCandidates.push(order.endDate.getTime());
      
      const confirmThreshold = order.confirmedAt?.getTime() ?? order.createdAt.getTime();
      for (const plan of order.schedulePlans) {
        if (plan.startTime.getTime() >= confirmThreshold) {
          startCandidates.push(plan.startTime.getTime());
          if (plan.endTime) endCandidates.push(plan.endTime.getTime());
        }
      }
      
      lockStartTime = Math.min(...startCandidates) - (6 * 60 * 60 * 1000);
      if (endCandidates.length > 0) {
        lockEndTime = Math.max(...endCandidates, ...startCandidates) + (6 * 60 * 60 * 1000);
      } else {
        lockEndTime = Infinity;
      }

      if (lockStartTime < nextDayTime && lockEndTime >= queryTime) {
        const orderNeed = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const supplierCovered = supplierCoveredByOrder.get(order.orderId) ?? 0;
        totalLocked += Math.max(orderNeed - supplierCovered, 0);
      }
    }
    return totalLocked;
  },

  adjustTotal(itemId: string, deltaTotal: number): Promise<InventoryWithItem> {
    return prisma.inventory.update({
      where: { itemId },
      data: { quantityTotal: { increment: deltaTotal } },
      include: inventoryItemInclude,
    });
  },

  // Sửa chữa hàng hỏng: chỉ giảm quantity_damaged (total KHÔNG đổi — hàng sửa xong quay lại dùng được).
  repairDamaged(itemId: string, quantity: number): Promise<InventoryWithItem> {
    return prisma.inventory.update({
      where: { itemId },
      data: { quantityDamaged: { decrement: quantity } },
      include: inventoryItemInclude,
    });
  },

  // Thanh lý hàng hỏng: giảm cả damaged lẫn total (mất khỏi sở hữu) + ghi ADJUSTMENT(−qty) trong 1 transaction.
  async scrapDamaged(itemId: string, quantity: number, performedBy: string, notes: string | null): Promise<InventoryWithItem> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.inventory.update({
        where: { itemId },
        data: { quantityDamaged: { decrement: quantity }, quantityTotal: { decrement: quantity } },
        include: inventoryItemInclude,
      });
      await tx.inventoryMovement.create({
        data: { itemId, orderId: null, reportId: null, movementType: 'ADJUSTMENT', quantity: -quantity, performedBy, notes: notes ?? null },
      });
      return updated;
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

  async getExportedQuantity(orderId: string, itemId: string): Promise<number> {
    const agg = await prisma.inventoryMovement.aggregate({
      where: { orderId, itemId, movementType: 'OUTBOUND' },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? 0;
  },

  findOrderItemsForPicklist(orderId: string) {
    return prisma.orderItem.findMany({
      where: { orderId },
      include: {
        item: { select: { itemName: true, unit: true, rentalPrice: true, inventory: { select: { quantityTotal: true, quantityDamaged: true } } } },
      },
    });
  },

  async findReports(filter: ReportListFilter, skip: number, take: number) {
    const where: Prisma.CollectedEquipmentReportWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.orderId) where.orderId = filter.orderId;
    if (filter.reportType) where.reportType = filter.reportType;
    if (filter.transactionId) where.transactionId = filter.transactionId;

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
    evidenceIds: string[];
  }): Promise<ReportWithDetails> {
    return prisma.collectedEquipmentReport.create({
      data: {
        orderId: data.orderId,
        reportType: data.reportType,
        transactionId: data.transactionId,
        reportedBy: data.reportedBy,
        notes: data.notes,
        items: { create: data.items },
        evidences: data.evidenceIds.length > 0 ? { create: data.evidenceIds.map((id) => ({ evidenceId: id })) } : undefined,
      },
      include: reportInclude,
    });
  },

  // Xác nhận báo cáo thu hồi + áp dụng hiệu ứng tồn kho theo mô hình rental (Phase 2):
  //   damaged += damaged (hỏng: vẫn sở hữu, không dùng được) · total −= lost (mất hẳn) ·
  //   good về kho KHÔNG đổi total (total = số sở hữu, không trừ lúc xuất) · ghi INBOUND (good+damaged).
  // Tất cả trong CÙNG 1 transaction — không có trạng thái "đã confirm nhưng chưa cập nhật tồn".
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
        await tx.inventory.update({
          where: { itemId: line.itemId },
          data: {
            quantityDamaged: { increment: line.damagedQuantity },
            quantityTotal: { decrement: line.lostQuantity }, // total = sở hữu: chỉ trừ phần MẤT (good/damaged vẫn thuộc sở hữu)
          },
        });
      }

      // Set order_id (trước đây NULL) để công thức net_exported của export-equipment v2 phản ánh
      // "đồ đã về kho thì được phép xuất lại" — docs/api/xuatthietbi_tubaogia_api.md mục 4.1 bước 2.1.
      // INBOUND reconcile TOÀN BỘ số đã xuất của dòng này (good+damaged về kho + lost đã xác nhận mất)
      // để Σ(OUTBOUND)−Σ(INBOUND) phản ánh đúng "đang còn ngoài kho", KHÔNG để phần lost tồn dư vĩnh viễn
      // trong on-hand (review P0 finding #3). `total` đã −= lost ở trên; good/damaged vẫn thuộc sở hữu.
      const movementLines = items.filter((line) => line.goodQuantity + line.damagedQuantity + line.lostQuantity > 0);
      if (movementLines.length > 0) {
        await tx.inventoryMovement.createMany({
          data: movementLines.map((line) => ({
            itemId: line.itemId,
            reportId,
            orderId,
            movementType: 'INBOUND' as const,
            quantity: line.goodQuantity + line.damagedQuantity + line.lostQuantity,
            performedBy: confirmedBy,
            notes: `Thu hồi: ${line.goodQuantity} tốt, ${line.damagedQuantity} hỏng, ${line.lostQuantity} mất`,
          })),
        });
      }
    });

    const report = await prisma.collectedEquipmentReport.findUnique({ where: { reportId }, include: reportInclude });
    if (!report) throw AppError.internal('Không tìm thấy phiếu thu hồi thiết bị sau khi xác nhận');
    return report;
  },

  // Xác nhận báo cáo thu hồi KHÔNG áp bất kỳ hiệu ứng tồn kho nào — dùng cho báo cáo loại SUPPLIER (thiết
  // bị THUÊ của Nhà cung cấp): hàng thuộc sở hữu NCC, trả lại cho NCC, không nhập về kho nội bộ nên tuyệt
  // đối không được đụng `inventory` (không +damaged, không −total, không ghi INBOUND). Chỉ đánh dấu Manager
  // đã duyệt phiếu trả NCC (đối soát tiền đền bù NCC là nghiệp vụ tách riêng, không thuộc luồng này).
  async confirmReportOnly(reportId: string, confirmedBy: string): Promise<ReportWithDetails> {
    await prisma.collectedEquipmentReport.update({
      where: { reportId },
      data: { status: 'CONFIRMED', confirmedBy, confirmedAt: new Date() },
    });
    const report = await prisma.collectedEquipmentReport.findUnique({ where: { reportId }, include: reportInclude });
    if (!report) throw AppError.internal('Không tìm thấy phiếu thu hồi thiết bị sau khi xác nhận');
    return report;
  },

  // POST /schedule-plans/:planId/warehouse-movement — Leader ghi nhận hàng RỜI kho tại hiện trường.
  // Mô hình rental (Phase 2): xuất kho KHÔNG trừ quantity_total (= số sở hữu) — chỉ ghi 1 dòng
  // inventory_movements(OUTBOUND). Guard theo TỒN VẬT LÝ (on-hand = total − damaged − đang-ngoài-kho),
  // khóa dòng inventory (FOR UPDATE) NGAY TRONG transaction để serialize các lần xuất đồng thời trên
  // cùng item — ném `InsufficientFieldStockError` (repository thuần) để service dịch thành lỗi 400.
  async recordFieldOutbound(params: {
    orderId: string;
    performedBy: string;
    notes: string | null;
    items: { itemId: string; quantity: number }[];
  }): Promise<MovementWithDetails[]> {
    const movementIds = await prisma.$transaction(async (tx) => {
      const created: string[] = [];
      for (const line of params.items) {
        // Khóa dòng inventory của item rồi kiểm tồn vật lý trước khi ghi OUTBOUND.
        await tx.$queryRaw`SELECT inventory_id FROM inventory WHERE item_id = ${line.itemId} FOR UPDATE`;
        const onHand = await reservationRepository.getOnHandNow(line.itemId, tx);
        if (onHand < line.quantity) {
          throw new InsufficientFieldStockError(line.itemId, onHand, line.quantity);
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            itemId: line.itemId,
            orderId: params.orderId,
            reportId: null,
            movementType: 'OUTBOUND',
            quantity: line.quantity,
            performedBy: params.performedBy,
            notes: params.notes,
          },
          select: { movementId: true },
        });
        created.push(movement.movementId);
      }
      return created;
    }, { isolationLevel: 'ReadCommitted' });

    return prisma.inventoryMovement.findMany({ where: { movementId: { in: movementIds } }, include: movementInclude });
  },
};

export class InsufficientFieldStockError extends Error {
  constructor(
    readonly itemId: string,
    readonly quantityAvailable: number,
    readonly requested: number,
  ) {
    super('Không đủ tồn kho khả dụng để xuất tại hiện trường');
  }
}
