import { Prisma } from '@prisma/client';
import type { PrismaClient, ReservationStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/AppError';

// ============================================================================
// RESERVATION REPOSITORY — nguồn tính khả dụng cho luồng cho thuê (Phase 1-3).
//
// Nguyên tắc bất biến (xem docs/inventory-rental-refactor-plan.md):
//  - quantity_total = số SỞ HỮU (chỉ đổi khi mua / thanh lý / mất khi thu hồi).
//  - available(item,[s,e]) = total − damaged − reserved(item,[s,e])   (tính động, không lưu counter).
//  - on_hand(item,now)     = total − damaged − (ΣOUTBOUND − ΣINBOUND) (tồn vật lý đang trong kho).
//  - Chỉ order_items source=INTERNAL sinh reservation (phần thuê NCC không giữ kho nội bộ).
// ============================================================================

// Đệm cửa sổ giữ chỗ. P0 để hằng số; có thể chuyển sang module settings (plan Phase 0).
export const SETUP_BUFFER_HOURS = 24; // giữ trước giờ sự kiện để vận chuyển/lắp
export const TURNAROUND_DAYS = 1; // sau khi trả: kiểm/giặt/làm sạch trước khi cho thuê lại

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

type Tx = Prisma.TransactionClient | PrismaClient;
const db = (tx?: Tx): Tx => tx ?? prisma;

export interface ReservationWindow {
  startAt: Date;
  endAt: Date;
}

/** Cửa sổ giữ chỗ của 1 đơn = [eventDate − setupBuffer, (endDate ?? eventDate) + turnaround]. */
export function orderWindow(eventDate: Date, endDate: Date | null): ReservationWindow {
  const startAt = new Date(eventDate.getTime() - SETUP_BUFFER_HOURS * HOUR_MS);
  const base = endDate ?? eventDate;
  const endAt = new Date(base.getTime() + TURNAROUND_DAYS * DAY_MS);
  return { startAt, endAt };
}

/** Tổng đã GIỮ CHẮC của 1 item giao với [start,end] (mặc định chỉ status=CONFIRMED). */
async function getReservedForRange(
  itemId: string,
  start: Date,
  end: Date,
  opts: { excludeOrderId?: string; statuses?: ReservationStatus[]; tx?: Tx } = {},
): Promise<number> {
  const statuses = opts.statuses ?? (['CONFIRMED'] as ReservationStatus[]);
  const agg = await db(opts.tx).inventoryReservation.aggregate({
    where: {
      itemId,
      status: { in: statuses },
      startAt: { lt: end }, // overlap: A.start < B.end && A.end > B.start
      endAt: { gt: start },
      ...(opts.excludeOrderId ? { orderId: { not: opts.excludeOrderId } } : {}),
    },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

export type ReservationWithOrder = Prisma.InventoryReservationGetPayload<{
  include: { order: { select: { orderCode: true; eventDate: true; endDate: true; customer: { select: { customerName: true } } } } };
}>;

/** Liệt kê TỪNG reservation (mặc định CONFIRMED) của 1 item giao với [start,end], kèm thông tin đơn. */
function listReservationsForItem(
  itemId: string,
  start: Date,
  end: Date,
  opts: { statuses?: ReservationStatus[]; tx?: Tx } = {},
): Promise<ReservationWithOrder[]> {
  const statuses = opts.statuses ?? (['CONFIRMED'] as ReservationStatus[]);
  return db(opts.tx).inventoryReservation.findMany({
    where: { itemId, status: { in: statuses }, startAt: { lt: end }, endAt: { gt: start } },
    include: { order: { select: { orderCode: true, eventDate: true, endDate: true, customer: { select: { customerName: true } } } } },
    orderBy: { startAt: 'asc' },
  });
}

/** BATCH: tổng đã giữ chắc (CONFIRMED) của NHIỀU item giao với [start,end] — 1 query GROUP BY (chống N+1). */
async function getReservedForRangeBatch(
  itemIds: string[],
  start: Date,
  end: Date,
  opts: { statuses?: ReservationStatus[]; excludeOrderId?: string; tx?: Tx } = {},
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (itemIds.length === 0) return map;
  const statuses = opts.statuses ?? (['CONFIRMED'] as ReservationStatus[]);
  const rows = await db(opts.tx).inventoryReservation.groupBy({
    by: ['itemId'],
    where: {
      itemId: { in: itemIds },
      status: { in: statuses },
      startAt: { lt: end },
      endAt: { gt: start },
      // Loại trừ reservation của CHÍNH đơn đang xét (xem khả dụng "cho đơn này"): nếu không, đơn đã
      // CONFIRMED tự giữ chỗ rồi lại bị đếm chính phần đó là "đã bị giữ" ⇒ khả dụng tụt về 0, cảnh báo
      // "cần thuê" sai (đơn tính reservation của nó chống lại nó). Khớp getReservedForRange đơn lẻ.
      ...(opts.excludeOrderId ? { orderId: { not: opts.excludeOrderId } } : {}),
    },
    _sum: { quantity: true },
  });
  for (const r of rows) map.set(r.itemId, r._sum.quantity ?? 0);
  return map;
}

/** BATCH: số đang ở ngoài kho (ΣOUTBOUND − ΣINBOUND) của NHIỀU item — 1 query GROUP BY (chống N+1). */
async function getOutstandingOutBatch(itemIds: string[], tx?: Tx): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (itemIds.length === 0) return map;
  const rows = await db(tx).inventoryMovement.groupBy({
    by: ['itemId', 'movementType'],
    where: { itemId: { in: itemIds }, movementType: { in: ['OUTBOUND', 'INBOUND'] } },
    _sum: { quantity: true },
  });
  for (const r of rows) {
    const q = r._sum.quantity ?? 0;
    const cur = map.get(r.itemId) ?? 0;
    map.set(r.itemId, cur + (r.movementType === 'OUTBOUND' ? q : -q));
  }
  for (const [k, v] of map) map.set(k, Math.max(v, 0));
  return map;
}

/** BATCH raw: tổng OUTBOUND & INBOUND (chưa kẹp) của nhiều item — cho đối soát on_hand (phát hiện lệch âm). */
async function getMovementSumsBatch(itemIds: string[], tx?: Tx): Promise<Map<string, { out: number; in: number }>> {
  const map = new Map<string, { out: number; in: number }>();
  if (itemIds.length === 0) return map;
  const rows = await db(tx).inventoryMovement.groupBy({
    by: ['itemId', 'movementType'],
    where: { itemId: { in: itemIds }, movementType: { in: ['OUTBOUND', 'INBOUND'] } },
    _sum: { quantity: true },
  });
  for (const r of rows) {
    const entry = map.get(r.itemId) ?? { out: 0, in: 0 };
    const q = r._sum.quantity ?? 0;
    if (r.movementType === 'OUTBOUND') entry.out += q;
    else entry.in += q;
    map.set(r.itemId, entry);
  }
  return map;
}

export type ReservationInRange = Prisma.InventoryReservationGetPayload<{
  include: {
    item: { select: { itemName: true; itemCode: true } };
    order: { select: { orderCode: true; customer: { select: { customerName: true } } } };
  };
}>;

/** Liệt kê MỌI reservation (mặc định CONFIRMED) giao với [start,end], kèm item + đơn — nuôi timeline thiết bị. */
function listReservationsInRange(
  start: Date,
  end: Date,
  opts: { statuses?: ReservationStatus[]; categoryId?: string; tx?: Tx } = {},
): Promise<ReservationInRange[]> {
  const statuses = opts.statuses ?? (['CONFIRMED'] as ReservationStatus[]);
  return db(opts.tx).inventoryReservation.findMany({
    where: {
      status: { in: statuses },
      startAt: { lt: end },
      endAt: { gt: start },
      ...(opts.categoryId ? { item: { type: { categoryId: opts.categoryId } } } : {}),
    },
    include: {
      item: { select: { itemName: true, itemCode: true } },
      order: { select: { orderCode: true, customer: { select: { customerName: true } } } },
    },
    orderBy: [{ itemId: 'asc' }, { startAt: 'asc' }],
  });
}

/** Số đang ở NGOÀI kho (đã xuất chưa về) = ΣOUTBOUND − ΣINBOUND từ inventory_movements. */
async function getOutstandingOut(itemId: string, tx?: Tx): Promise<number> {
  const rows = await db(tx).inventoryMovement.groupBy({
    by: ['movementType'],
    where: { itemId, movementType: { in: ['OUTBOUND', 'INBOUND'] } },
    _sum: { quantity: true },
  });
  let out = 0;
  for (const r of rows) {
    const q = r._sum.quantity ?? 0;
    if (r.movementType === 'OUTBOUND') out += q;
    else if (r.movementType === 'INBOUND') out -= q;
  }
  return Math.max(out, 0);
}

/** Tồn vật lý đang có trong kho ngay bây giờ = total − damaged − (đang ngoài kho). */
async function getOnHandNow(itemId: string, tx?: Tx): Promise<number> {
  const inv = await db(tx).inventory.findUnique({
    where: { itemId },
    select: { quantityTotal: true, quantityDamaged: true },
  });
  if (!inv) return 0;
  const out = await getOutstandingOut(itemId, tx);
  return inv.quantityTotal - inv.quantityDamaged - out;
}

/** Khả dụng để NHẬN ĐƠN cho khoảng [start,end] = total − damaged − reserved(range). */
async function getAvailableForRange(
  itemId: string,
  start: Date,
  end: Date,
  excludeOrderId?: string,
  tx?: Tx,
): Promise<number> {
  const inv = await db(tx).inventory.findUnique({
    where: { itemId },
    select: { quantityTotal: true, quantityDamaged: true },
  });
  if (!inv) return 0;
  const reserved = await getReservedForRange(itemId, start, end, { excludeOrderId, tx });
  return inv.quantityTotal - inv.quantityDamaged - reserved;
}

/** Nhả toàn bộ reservation đang giữ của 1 đơn (đơn hủy). */
function releaseByOrder(orderId: string, tx?: Tx) {
  return db(tx).inventoryReservation.updateMany({
    where: { orderId, status: { in: ['HELD', 'CONFIRMED'] } },
    data: { status: 'RELEASED' },
  });
}

/** Kết thúc vòng thuê: reservation của đơn ngừng tính (đơn đóng/COMPLETED). */
function consumeByOrder(orderId: string, tx?: Tx) {
  return db(tx).inventoryReservation.updateMany({
    where: { orderId, status: { in: ['HELD', 'CONFIRMED'] } },
    data: { status: 'CONSUMED' },
  });
}

/** Số reservation CONFIRMED hiện có của 1 đơn (dùng để idempotent). */
function countActiveByOrder(orderId: string, tx?: Tx): Promise<number> {
  return db(tx).inventoryReservation.count({ where: { orderId, status: 'CONFIRMED' } });
}

/**
 * Chốt giữ chỗ cho 1 đơn TRONG transaction — mắt xích chống overbooking.
 * ⚠️ Caller PHẢI mở transaction với isolationLevel 'ReadCommitted' — nếu để REPEATABLE READ (mặc định
 *    MySQL), các đọc non-locking (count, aggregate) dùng snapshot cũ và bỏ sót reservation vừa commit
 *    của transaction song song ⇒ guard bị vô hiệu (xem review P0 finding #1/#2).
 * Thứ tự (khóa TRƯỚC, đọc/kiểm SAU để đọc tươi):
 * 1) Gộp nhu cầu nội bộ (INTERNAL) theo item; dựng cửa sổ từ eventDate/endDate.
 * 2) Khóa dòng inventory (FOR UPDATE) — serialize các lần xác nhận đồng thời (cùng item hoặc cùng đơn).
 * 3) Idempotent: đã có reservation CONFIRMED thì bỏ qua (đọc SAU khóa nên thấy bản vừa commit).
 * 4) Với mỗi item: available = total − damaged − reserved(range, loại trừ chính đơn). KHÔNG chặn nếu
 *    thiếu — chỉ giữ chỗ phần khả dụng (reserve = min(need, available), luôn ≤ available nên không
 *    overbook). Phần thiếu để Manager thuê ngoài NCC (cảnh báo mềm computeStockWarnings / UI trang đơn).
 * 5) Tạo reservation CONFIRMED cho phần khả dụng (chỉ khi reserveQty > 0).
 */
async function reserveOrderStock(
  tx: Prisma.TransactionClient,
  orderId: string,
  createdBy: string,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { orderId },
    select: {
      eventDate: true,
      endDate: true,
      orderItems: { where: { source: 'INTERNAL' }, select: { itemId: true, quantity: true } },
    },
  });
  if (!order) throw AppError.notFound('Không tìm thấy đơn hàng khi giữ chỗ thiết bị');

  const needByItem = new Map<string, number>();
  for (const oi of order.orderItems) {
    needByItem.set(oi.itemId, (needByItem.get(oi.itemId) ?? 0) + oi.quantity);
  }
  if (needByItem.size === 0) return; // đơn không có thiết bị nội bộ → không giữ chỗ

  // Trừ phần đã THUÊ NCC (RENTAL) để bù thiếu (getRentedByItemForOrder). "Thuê từ NCC" chỉ tạo
  // supplier-transaction gắn orderId, KHÔNG đổi source order_item (vẫn INTERNAL) — nếu không trừ, giữ
  // chỗ sẽ đòi đủ 100% số nội bộ và chặn nhầm "Không đủ thiết bị" dù đã thuê bù.
  const rented = await getRentedByItemForOrder(orderId, tx);
  for (const [itemId, r] of rented) {
    const cur = needByItem.get(itemId);
    if (cur !== undefined) needByItem.set(itemId, Math.max(0, cur - r));
  }
  for (const [itemId, need] of [...needByItem]) {
    if (need <= 0) needByItem.delete(itemId); // đã thuê đủ → không cần giữ kho nội bộ item này
  }
  if (needByItem.size === 0) return; // toàn bộ nhu cầu đã được thuê ngoài bù

  const { startAt, endAt } = orderWindow(order.eventDate, order.endDate);

  // Khóa các dòng inventory liên quan (MySQL row lock) để chống race giữa nhiều lần xác nhận.
  const itemIds = [...needByItem.keys()];
  await tx.$queryRaw`SELECT inventory_id FROM inventory WHERE item_id IN (${Prisma.join(itemIds)}) FOR UPDATE`;

  // Idempotent — kiểm SAU khi đã giữ khóa (đọc tươi dưới READ COMMITTED): đã giữ chỗ rồi thì bỏ qua,
  // tránh 2 lần xác nhận cùng đơn (cọc PAID đua với manual →CONFIRMED / double-click) tạo trùng reservation.
  const already = await tx.inventoryReservation.count({ where: { orderId, status: 'CONFIRMED' } });
  if (already > 0) return;

  const rows: Prisma.InventoryReservationCreateManyInput[] = [];
  for (const [itemId, need] of needByItem) {
    const inv = await tx.inventory.findUnique({
      where: { itemId },
      select: { quantityTotal: true, quantityDamaged: true },
    });
    const total = inv?.quantityTotal ?? 0;
    const damaged = inv?.quantityDamaged ?? 0;
    const reserved = await getReservedForRange(itemId, startAt, endAt, { excludeOrderId: orderId, tx });
    const available = total - damaged - reserved;
    // KHÔNG chặn cứng khi thiếu kho (bỏ 409 cũ): chỉ giữ chỗ phần THỰC SỰ khả dụng — reserve ≤ available
    // nên KHÔNG BAO GIỜ overbook. Phần thiếu (need − reserveQty) do Manager thuê ngoài NCC; trang chi tiết
    // đơn đã có cảnh báo mềm "Thiếu · Thuê từ NCC" + computeStockWarnings. Nhờ vậy xác nhận đơn / xuất báo
    // giá / cọc PAID không còn bị khoá chỉ vì kho nội bộ không đủ.
    const reserveQty = Math.max(0, Math.min(need, available));
    if (reserveQty > 0) {
      rows.push({ itemId, orderId, quantity: reserveQty, startAt, endAt, status: 'CONFIRMED', createdBy });
    }
  }
  await tx.inventoryReservation.createMany({ data: rows });
}

// Cập nhật lại cửa sổ giữ chỗ của reservation đang giữ khi ngày của đơn thay đổi (review P0 finding #4):
// syncOrderDates ghi lại Order.endDate từ lịch SETUP/COLLECT SAU khi reservation đã snapshot cửa sổ.
async function resyncWindowsForOrder(orderId: string, tx?: Tx): Promise<void> {
  const order = await db(tx).order.findUnique({ where: { orderId }, select: { eventDate: true, endDate: true } });
  if (!order) return;
  const { startAt, endAt } = orderWindow(order.eventDate, order.endDate);
  await db(tx).inventoryReservation.updateMany({
    where: { orderId, status: { in: ['HELD', 'CONFIRMED'] } },
    data: { startAt, endAt },
  });
}

// Đồng bộ reservation của đơn khớp order_items INTERNAL hiện tại — gọi SAU khi sửa/hủy order_items trên
// đơn đã CONFIRMED/IN_PROGRESS (review P0 finding #10). Xóa reservation đang giữ rồi tạo lại (reserveOrderStock
// chỉ giữ phần khả dụng, KHÔNG chặn nếu thiếu). Đơn NEW/terminal: bỏ qua (chưa/không giữ chỗ active).
// ⚠️ Caller PHẢI mở transaction ReadCommitted (giống reserveOrderStock).
async function resyncReservationsForOrder(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({ where: { orderId }, select: { orderStatus: true, createdBy: true } });
  if (!order) return;
  if (order.orderStatus !== 'CONFIRMED' && order.orderStatus !== 'IN_PROGRESS') return;
  await tx.inventoryReservation.deleteMany({ where: { orderId, status: { in: ['HELD', 'CONFIRMED'] } } });
  await reserveOrderStock(tx, orderId, order.createdBy);
}

// Số lượng đã THUÊ NCC (RENTAL, chưa hủy) theo item cho 1 đơn. Đồ thuê đến từ NCC, KHÔNG giữ/rời kho nội
// bộ → phải trừ khỏi mọi phép tính "nhu cầu nội bộ" (giữ chỗ, xuất kho, sẵn sàng chuẩn bị) để không chặn
// nhầm "thiếu thiết bị" khi đã thuê bù. "Thuê từ NCC" không đổi source order_item (vẫn INTERNAL).
async function getRentedByItemForOrder(orderId: string, tx?: Prisma.TransactionClient): Promise<Map<string, number>> {
  const db = tx ?? prisma;
  const rows = await db.supplierTransactionItem.findMany({
    where: { transaction: { orderId, transactionType: 'RENTAL', status: { not: 'CANCELLED' } } },
    select: { itemId: true, quantity: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.itemId) continue;
    map.set(r.itemId, (map.get(r.itemId) ?? 0) + r.quantity);
  }
  return map;
}

// Bản gộp nhiều đơn (cho danh sách picklist) — trả về orderId -> (itemId -> số đã thuê).
async function getRentedByItemForOrders(orderIds: string[]): Promise<Map<string, Map<string, number>>> {
  const result = new Map<string, Map<string, number>>();
  if (orderIds.length === 0) return result;
  const rows = await prisma.supplierTransactionItem.findMany({
    where: { transaction: { orderId: { in: orderIds }, transactionType: 'RENTAL', status: { not: 'CANCELLED' } } },
    select: { itemId: true, quantity: true, transaction: { select: { orderId: true } } },
  });
  for (const r of rows) {
    const oid = r.transaction.orderId;
    if (!oid || !r.itemId) continue;
    if (!result.has(oid)) result.set(oid, new Map());
    const m = result.get(oid)!;
    m.set(r.itemId, (m.get(r.itemId) ?? 0) + r.quantity);
  }
  return result;
}

export const reservationRepository = {
  orderWindow,
  getRentedByItemForOrder,
  getRentedByItemForOrders,
  resyncWindowsForOrder,
  resyncReservationsForOrder,
  getReservedForRange,
  getReservedForRangeBatch,
  getOutstandingOutBatch,
  getMovementSumsBatch,
  listReservationsForItem,
  listReservationsInRange,
  getOutstandingOut,
  getOnHandNow,
  getAvailableForRange,
  releaseByOrder,
  consumeByOrder,
  countActiveByOrder,
  reserveOrderStock,
};
