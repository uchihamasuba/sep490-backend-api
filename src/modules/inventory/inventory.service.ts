import { AppError } from '../../utils/AppError';
import { scheduleRepository } from '../operations/schedule.repository';
import type { Actor } from '../operations/schedule.service';
import type { WarehouseMovementBody } from '../operations/schedule.validators';
import {
  InsufficientFieldStockError,
  inventoryRepository,
  type InventoryWithItem,
  type MovementWithDetails,
  type ReportWithDetails,
} from './inventory.repository';
import { supplierTransactionRepository } from '../operations/supplier.repository';
import { reservationRepository } from './reservation.repository';
import type {
  AdjustInventoryBody,
  CreateInventoryBody,
  CreateReportBody,
  ListInventoryQuery,
  ListMovementsQuery,
  ListReportsQuery,
  RepairInventoryBody,
  ScrapInventoryBody,
} from './inventory.validators';
import { notificationService } from '../shared/notification.service';

export interface InventoryDTO {
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  categoryName: string;
  typeName: string;
  rentalPrice: number;
  purchasePrice: number | null;
  quantityTotal: number;
  quantityDamaged: number;
  quantityReserved: number;
  quantityAvailable: number;
  quantityOnHand: number; // tồn vật lý đang trong kho = total − damaged − (đang cho mượn ngoài)
  updatedAt: string;
}

export interface MovementDTO {
  movementId: string;
  itemId: string;
  itemName: string;
  unit: string;
  orderId: string | null;
  reportId: string | null;
  movementType: string;
  quantity: number;
  performedBy: { userId: string; fullName: string };
  notes: string | null;
  createdAt: string;
}

export interface PicklistItemDTO {
  orderItemId: string;
  itemId: string;
  itemName: string;
  unit: string;
  rentalPrice: number;
  /** Giá mua thiết bị nội bộ — dùng để tính đền bù hỏng/mất (Số tiền = Giá mua × Số lượng), không dùng rentalPrice. */
  purchasePrice: number | null;
  source: string;
  quantityOrdered: number;
  /** Số đã THUÊ NCC cho item này (đến từ NCC, không lấy từ kho nội bộ). Cần chuẩn bị/xuất kho nội bộ = quantityOrdered − quantityRented. */
  quantityRented: number;
  quantityAvailable: number | null;
  quantityExported: number;
}

export interface ReportItemDTO {
  cerItemId: string;
  itemId: string;
  itemName: string;
  unit: string;
  goodQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  notes: string | null;
}

export interface ReportDTO {
  reportId: string;
  orderId: string;
  orderCode: string;
  reportType: string;
  transactionId: string | null;
  status: string;
  reportedBy: { userId: string; fullName: string };
  confirmedBy: { userId: string; fullName: string } | null;
  confirmedAt: string | null;
  notes: string | null;
  createdAt: string;
  items: ReportItemDTO[];
  evidenceIds: string[];
}

export interface ListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

function mapInventory(row: InventoryWithItem, lockedQty: number, onHand: number): InventoryDTO {
  return {
    itemId: row.itemId,
    itemName: row.item.itemName,
    itemCode: row.item.itemCode,
    unit: row.item.unit,
    categoryName: row.item.type.category.categoryName,
    typeName: row.item.type.typeName,
    rentalPrice: Number(row.item.rentalPrice),
    purchasePrice: row.item.purchasePrice === null ? null : Number(row.item.purchasePrice),
    quantityTotal: row.quantityTotal,
    quantityDamaged: row.quantityDamaged,
    quantityReserved: lockedQty,
    quantityAvailable: row.quantityTotal - row.quantityDamaged - lockedQty,
    quantityOnHand: onHand,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapMovement(row: MovementWithDetails): MovementDTO {
  return {
    movementId: row.movementId,
    itemId: row.itemId,
    itemName: row.item.itemName,
    unit: row.item.unit,
    orderId: row.orderId,
    reportId: row.reportId,
    movementType: row.movementType,
    quantity: row.quantity,
    performedBy: { userId: row.performer.userId, fullName: row.performer.fullName },
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapReport(row: ReportWithDetails): ReportDTO {
  return {
    reportId: row.reportId,
    orderId: row.orderId,
    orderCode: row.order.orderCode,
    reportType: row.reportType,
    transactionId: row.transactionId,
    status: row.status,
    reportedBy: { userId: row.reporter.userId, fullName: row.reporter.fullName },
    confirmedBy: row.confirmer ? { userId: row.confirmer.userId, fullName: row.confirmer.fullName } : null,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    items: row.items.map((item) => ({
      cerItemId: item.cerItemId,
      itemId: item.itemId,
      itemName: item.item.itemName,
      unit: item.item.unit,
      goodQuantity: item.goodQuantity,
      damagedQuantity: item.damagedQuantity,
      lostQuantity: item.lostQuantity,
      notes: item.notes,
    })),
    evidenceIds: row.evidences.map((e) => e.evidenceId),
  };
}

function toMeta(page: number, limit: number, totalItems: number): ListMeta {
  return { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) };
}

async function findInventoryOrThrow(itemId: string): Promise<InventoryWithItem> {
  const row = await inventoryRepository.findByItemId(itemId);
  if (!row) throw AppError.notFound('Không tìm thấy hồ sơ tồn kho cho thiết bị này');
  return row;
}

async function listInventory(query: ListInventoryQuery): Promise<{ data: InventoryDTO[]; meta: ListMeta }> {
  const skip = (query.page - 1) * query.limit;
  const { rows, totalItems } = await inventoryRepository.findMany({ itemId: query.itemId, search: query.search }, skip, query.limit);
  const queryStart = query.date ? new Date(query.date) : new Date();
  const queryEnd = new Date(queryStart.getTime() + 24 * 60 * 60 * 1000);

  // Gộp N+1: thay vì 2 query/dòng (reserved + outstanding), dùng 2 query GROUP BY cho cả trang.
  const itemIds = rows.map((row) => row.itemId);
  const [reservedMap, outstandingMap] = await Promise.all([
    // excludeOrderId: khi trang chi tiết 1 đơn hỏi khả dụng "cho đơn này", loại trừ chính reservation của
    // đơn đó để không tự trừ phần mình đã giữ (tránh cảnh báo "cần thuê" ảo sau khi CONFIRMED).
    reservationRepository.getReservedForRangeBatch(itemIds, queryStart, queryEnd, { excludeOrderId: query.excludeOrderId }),
    reservationRepository.getOutstandingOutBatch(itemIds),
  ]);
  const data = rows.map((row) => {
    const reservedQty = reservedMap.get(row.itemId) ?? 0;
    const onHand = row.quantityTotal - row.quantityDamaged - (outstandingMap.get(row.itemId) ?? 0);
    return mapInventory(row, reservedQty, onHand);
  });

  return { data, meta: toMeta(query.page, query.limit, totalItems) };
}

async function getInventoryByItemId(itemId: string): Promise<InventoryDTO> {
  const row = await findInventoryOrThrow(itemId);
  const now = new Date();
  const reservedQty = await reservationRepository.getReservedForRange(itemId, now, new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const onHand = row.quantityTotal - row.quantityDamaged - (await reservationRepository.getOutstandingOut(itemId));
  return mapInventory(row, reservedQty, onHand);
}

async function listMovements(query: ListMovementsQuery): Promise<{ data: MovementDTO[]; meta: ListMeta }> {
  const skip = (query.page - 1) * query.limit;
  const { rows, totalItems } = await inventoryRepository.findMovements(
    { itemId: query.itemId, orderId: query.orderId, movementType: query.movementType },
    skip,
    query.limit,
  );
  return { data: rows.map(mapMovement), meta: toMeta(query.page, query.limit, totalItems) };
}

async function getPicklist(orderId: string): Promise<PicklistItemDTO[]> {
  const order = await inventoryRepository.orderExists(orderId);
  if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');

  const rows = await inventoryRepository.findOrderItemsForPicklist(orderId);
  // Số đã thuê NCC theo item — để app hiện "cần chuẩn bị nội bộ" = quantityOrdered − quantityRented.
  const rentedByItem = await reservationRepository.getRentedByItemForOrder(orderId);

  return Promise.all(rows.map(async (row) => {
    let quantityAvailable = null;
    let quantityExported = 0;
    if (row.item.inventory) {
      // Picklist quan tâm "hàng còn thật trong kho để lấy hôm nay" = on-hand (mô hình rental Phase 2/4).
      quantityAvailable = await reservationRepository.getOnHandNow(row.itemId);
    }
    quantityExported = await inventoryRepository.getExportedQuantity(orderId, row.itemId);

    return {
      orderItemId: row.orderItemId,
      itemId: row.itemId,
      itemName: row.item.itemName,
      unit: row.item.unit,
      rentalPrice: Number(row.item.rentalPrice),
      purchasePrice: row.item.purchasePrice === null ? null : Number(row.item.purchasePrice),
      source: row.source,
      quantityOrdered: row.quantity,
      quantityRented: rentedByItem.get(row.itemId) ?? 0,
      quantityAvailable,
      quantityExported,
    };
  }));
}

// POST /api/v1/inventory — khởi tạo dòng tồn kho cho 1 item chưa từng có (Inventory là quan hệ 1-1
// optional với Item, docs/api/more-require.md mục (b): item mới tạo chưa có tồn kho, cần nhập kho
// riêng). Không có endpoint nào khác tạo được dòng inventory đầu tiên — adjust/reserve/release đều yêu
// cầu dòng đã tồn tại (findInventoryOrThrow).
async function createInventory(body: CreateInventoryBody): Promise<InventoryDTO> {
  const item = await inventoryRepository.itemExists(body.itemId);
  if (!item) throw AppError.notFound('Không tìm thấy thiết bị');

  const existing = await inventoryRepository.findByItemId(body.itemId);
  if (existing) throw AppError.conflict('Hồ sơ tồn kho cho thiết bị này đã tồn tại');

  if (body.quantityDamaged > body.quantityTotal) {
    throw AppError.badRequest('Số lượng hư hỏng không được vượt quá tổng số lượng');
  }

  const created = await inventoryRepository.create({
    itemId: body.itemId,
    quantityTotal: body.quantityTotal,
    quantityDamaged: body.quantityDamaged,
  });

  return mapInventory(created, 0, created.quantityTotal - created.quantityDamaged);
}

async function adjustInventory(body: AdjustInventoryBody, actorId: string): Promise<InventoryDTO> {
  await findInventoryOrThrow(body.itemId); // đảm bảo dòng tồn kho tồn tại (404 nếu không)
  // Giảm tồn (thanh lý) chỉ được với hàng còn THẬT trong kho (on-hand), không đụng phần đang cho thuê.
  const onHand = await reservationRepository.getOnHandNow(body.itemId);

  if (body.deltaTotal < 0 && onHand < Math.abs(body.deltaTotal)) {
    throw AppError.badRequest('Không đủ tồn vật lý (on-hand) để giảm tồn kho', {
      onHand,
      requested: Math.abs(body.deltaTotal),
    });
  }

  const updated = await inventoryRepository.adjustTotal(body.itemId, body.deltaTotal);
  await inventoryRepository.createMovement({
    itemId: body.itemId,
    orderId: null,
    reportId: null,
    movementType: 'ADJUSTMENT',
    quantity: body.deltaTotal,
    performedBy: actorId,
    notes: body.notes || null,
  });

  const deltaSign = body.deltaTotal > 0 ? '+' : '';
  void notificationService.broadcastToPrivilegedUsers(
    'Nhật ký biến động kho',
    `Điều chỉnh thủ công ${deltaSign}${body.deltaTotal} ${updated.item.unit} - ${updated.item.itemName}`,
  );

  const now = new Date();
  const reservedQty = await reservationRepository.getReservedForRange(body.itemId, now, new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const onHandAfter = updated.quantityTotal - updated.quantityDamaged - (await reservationRepository.getOutstandingOut(body.itemId));
  return mapInventory(updated, reservedQty, onHandAfter);
}

// Dựng lại DTO có đủ reserved (theo ngày) + on-hand cho 1 dòng inventory vừa cập nhật.
async function mapInventoryFresh(row: InventoryWithItem): Promise<InventoryDTO> {
  const now = new Date();
  const reservedQty = await reservationRepository.getReservedForRange(row.itemId, now, new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const onHand = row.quantityTotal - row.quantityDamaged - (await reservationRepository.getOutstandingOut(row.itemId));
  return mapInventory(row, reservedQty, onHand);
}

// Bảo trì — SỬA CHỮA: damaged −= qty (total KHÔNG đổi, hàng sửa xong quay lại dùng được).
async function repairInventory(body: RepairInventoryBody): Promise<InventoryDTO> {
  const row = await findInventoryOrThrow(body.itemId);
  if (body.quantity > row.quantityDamaged) {
    throw AppError.badRequest('Số lượng sửa chữa vượt quá số lượng hỏng hiện có', {
      quantityDamaged: row.quantityDamaged,
      requested: body.quantity,
    });
  }
  const updated = await inventoryRepository.repairDamaged(body.itemId, body.quantity);
  return mapInventoryFresh(updated);
}

// Bảo trì — THANH LÝ: damaged −= qty, total −= qty (mất khỏi sở hữu) + ghi ADJUSTMENT(−qty).
async function scrapInventory(body: ScrapInventoryBody, actorId: string): Promise<InventoryDTO> {
  const row = await findInventoryOrThrow(body.itemId);
  if (body.quantity > row.quantityDamaged) {
    throw AppError.badRequest('Số lượng thanh lý vượt quá số lượng hỏng hiện có', {
      quantityDamaged: row.quantityDamaged,
      requested: body.quantity,
    });
  }
  const updated = await inventoryRepository.scrapDamaged(body.itemId, body.quantity, actorId, body.notes || null);
  
  void notificationService.broadcastToPrivilegedUsers(
    'Nhật ký biến động kho',
    `Thanh lý ${body.quantity} ${row.item.unit} thiết bị hỏng - ${row.item.itemName}`,
  );

  return mapInventoryFresh(updated);
}

export interface ReservationDTO {
  reservationId: string;
  itemId: string;
  orderId: string | null;
  orderCode: string | null;
  customerName: string | null;
  eventDate: string | null;
  endDate: string | null;
  startAt: string;
  endAt: string;
  quantity: number;
  status: string;
}

// Lịch bận thiết bị: liệt kê từng reservation (CONFIRMED) của 1 item trong khoảng [from, to] (mặc định 90 ngày).
async function listItemReservations(itemId: string, from?: Date, to?: Date): Promise<ReservationDTO[]> {
  await findInventoryOrThrow(itemId);
  const start = from ?? new Date();
  const end = to ?? new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  const rows = await reservationRepository.listReservationsForItem(itemId, start, end);
  return rows.map((r) => ({
    reservationId: r.reservationId,
    itemId: r.itemId,
    orderId: r.orderId,
    orderCode: r.order ? r.order.orderCode : null,
    customerName: r.order ? r.order.customer.customerName : null,
    eventDate: r.order ? r.order.eventDate.toISOString() : null,
    endDate: r.order && r.order.endDate ? r.order.endDate.toISOString() : null,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    quantity: r.quantity,
    status: r.status,
  }));
}

async function listReports(query: ListReportsQuery): Promise<{ data: ReportDTO[]; meta: ListMeta }> {
  const skip = (query.page - 1) * query.limit;
  const { rows, totalItems } = await inventoryRepository.findReports(
    { status: query.status, orderId: query.orderId, reportType: query.reportType, transactionId: query.transactionId },
    skip,
    query.limit,
  );
  return { data: rows.map(mapReport), meta: toMeta(query.page, query.limit, totalItems) };
}

async function findReportOrThrow(reportId: string): Promise<ReportWithDetails> {
  const report = await inventoryRepository.findReportById(reportId);
  if (!report) throw AppError.notFound('Không tìm thấy phiếu thu hồi thiết bị');
  return report;
}

async function getReportById(reportId: string): Promise<ReportDTO> {
  const report = await findReportOrThrow(reportId);
  return mapReport(report);
}

async function createReport(body: CreateReportBody, actor: Actor): Promise<ReportDTO> {
  const order = await inventoryRepository.orderExists(body.orderId);
  if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');

  if (actor.role === 'STAFF') {
    const isLead = await scheduleRepository.isUserLeadOnOrder(actor.id, body.orderId);
    if (!isLead) {
      throw AppError.forbidden('Chỉ Leader giữ vai trò LEAD trong kế hoạch của đơn hàng này mới được nộp báo cáo thu hồi thiết bị');
    }
  }

  for (const line of body.items) {
    const item = await inventoryRepository.itemExists(line.itemId);
    if (!item) throw AppError.notFound(`Không tìm thấy thiết bị: ${line.itemId}`, { itemId: line.itemId });
  }

  const created = await inventoryRepository.createReport({
    orderId: body.orderId,
    reportType: body.reportType,
    transactionId: body.transactionId ?? null,
    reportedBy: actor.id,
    notes: body.notes || null,
    items: body.items.map((line) => ({
      itemId: line.itemId,
      goodQuantity: line.goodQuantity,
      damagedQuantity: line.damagedQuantity,
      lostQuantity: line.lostQuantity,
      notes: line.notes || null,
    })),
    evidenceIds: body.evidenceIds ?? [],
  });

  const dto = mapReport(created);
  // Báo Manager/Admin có báo cáo thu hồi thiết bị mới do Leader nộp tại hiện trường — chờ xác nhận.
  void notificationService.broadcastToPrivilegedUsers(
    'Báo cáo thu hồi thiết bị mới',
    `Đơn ${dto.orderCode} có báo cáo thu hồi thiết bị chờ xác nhận`,
    'INVENTORY',
    dto.orderId,
    'ORDER',
  );
  return dto;
}

// docs/api/api.md gap (k), đã chốt 2026-07-22: Leader tự xác nhận "đã trả kho/NCC" trên app, giới hạn
// theo order của plan họ được phân công (cùng mẫu assertActorCanAccessTransaction ở supplier.service.ts).
async function confirmReport(reportId: string, actor: Actor): Promise<ReportDTO> {
  const report = await findReportOrThrow(reportId);
  if (report.status !== 'SUBMITTED') {
    throw AppError.badRequest(`Chỉ có thể xác nhận báo cáo đang ở trạng thái SUBMITTED (hiện tại: ${report.status})`);
  }

  if (actor.role === 'STAFF') {
    const isLead = await scheduleRepository.isUserLeadOnOrder(actor.id, report.orderId);
    if (!isLead) {
      throw AppError.forbidden('Chỉ Leader giữ vai trò LEAD trong kế hoạch của đơn hàng này mới được xác nhận báo cáo');
    }
  }

  // Báo cáo SUPPLIER = thiết bị THUÊ của NCC được trả lại cho NCC — KHÔNG nhập về kho nội bộ. Chỉ đánh dấu
  // đã duyệt phiếu trả, tuyệt đối không áp hiệu ứng tồn kho (nếu áp sẽ cộng nhầm hàng NCC vào tồn kho mình,
  // hoặc crash khi item không có dòng inventory). Đối soát/đền bù NCC là nghiệp vụ tách riêng.
  if (report.reportType === 'SUPPLIER') {
    const confirmed = await inventoryRepository.confirmReportOnly(reportId, actor.id);
    if (confirmed.transactionId) {
      const items = confirmed.items.map(i => ({
        itemId: i.itemId,
        damagedQuantity: i.damagedQuantity,
        lostQuantity: i.lostQuantity
      }));
      await supplierTransactionRepository.applyRentalReturnPenalty(confirmed.transactionId, items, actor.id);
    }
    return mapReport(confirmed);
  }

  for (const line of report.items) {
    if (line.lostQuantity <= 0) continue;
    const inv = await inventoryRepository.findByItemId(line.itemId);
    if (!inv) throw AppError.notFound(`Không tìm thấy hồ sơ tồn kho cho thiết bị ${line.itemId}`);
    if (inv.quantityTotal < line.lostQuantity) {
      throw AppError.badRequest(`Số lượng thất lạc của "${inv.item.itemName}" vượt quá tổng tồn kho hiện có`, {
        itemId: line.itemId,
        quantityTotal: inv.quantityTotal,
        lostQuantity: line.lostQuantity,
      });
    }
  }

  const confirmed = await inventoryRepository.confirmReportAndApplyInventory(
    reportId,
    report.orderId,
    actor.id,
    report.items.map((line) => ({
      itemId: line.itemId,
      goodQuantity: line.goodQuantity,
      damagedQuantity: line.damagedQuantity,
      lostQuantity: line.lostQuantity,
    })),
  );

  const totalDamaged = report.items.reduce((sum, line) => sum + line.damagedQuantity, 0);
  const totalLost = report.items.reduce((sum, line) => sum + line.lostQuantity, 0);
  if (totalDamaged > 0 || totalLost > 0) {
    void notificationService.broadcastToPrivilegedUsers(
      `Báo cáo thu hồi từ đơn ${report.order.orderCode}`,
      `Thiết bị có vấn đề (Hỏng: ${totalDamaged}, Mất: ${totalLost}) được báo cáo bởi ${report.reporter.fullName}`,
    );
  }

  return mapReport(confirmed);
}

// POST /schedule-plans/:planId/warehouse-movement (docs/api/api.md gap (g)) — Leader ghi nhận xuất kho
// doanh nghiệp thực tế tại hiện trường (TSK-SETUP). Chỉ Leader giữ vai trò LEAD của đúng plan đó được
// gọi (không phải mọi assignee) — khớp gate `isLead` phía FE (WarehouseMovementSection).
async function recordFieldOutbound(planId: string, body: WarehouseMovementBody, actor: Actor): Promise<MovementDTO[]> {
  const plan = await scheduleRepository.findById(planId);
  if (!plan) throw AppError.notFound('Không tìm thấy kế hoạch lịch trình');

  const isLeadAssignee = plan.assignees.some((a) => a.userId === actor.id && a.role === 'LEAD');
  if (!isLeadAssignee) {
    throw AppError.forbidden('Chỉ Leader giữ vai trò LEAD trong kế hoạch này mới được ghi nhận xuất kho');
  }

  for (const line of body.items) {
    const item = await inventoryRepository.itemExists(line.itemId);
    if (!item) throw AppError.notFound(`Không tìm thấy thiết bị: ${line.itemId}`, { itemId: line.itemId });
  }

  try {
    const movements = await inventoryRepository.recordFieldOutbound({
      orderId: plan.orderId,
      performedBy: actor.id,
      notes: body.notes || null,
      items: body.items,
    });

    void notificationService.broadcastToPrivilegedUsers(
      `Xuất kho hiện trường cho ${plan.order.orderCode}`,
      `Đơn hàng ${plan.order.orderCode} vừa xuất kho tại hiện trường`,
    );

    return movements.map(mapMovement);
  } catch (err) {
    if (err instanceof InsufficientFieldStockError) {
      throw AppError.badRequest(err.message, {
        itemId: err.itemId,
        quantityAvailable: err.quantityAvailable,
        requested: err.requested,
      });
    }
    throw err;
  }
}

// ============================================================================
// ĐỐI SOÁT on_hand (Phase 6) — dựng lại từ inventory_movements, phát hiện bất biến bị vi phạm.
// ============================================================================
export interface ReconcileItemDTO {
  itemId: string;
  itemName: string;
  quantityTotal: number;
  quantityDamaged: number;
  outbound: number; // Σ OUTBOUND
  inbound: number; // Σ INBOUND
  outstanding: number; // out − in (chưa kẹp; âm = thu hồi > xuất → lỗi)
  onHand: number; // total − damaged − outstanding
  flags: string[]; // các bất biến bị vi phạm (rỗng = OK)
}
export interface ReconcileResult {
  checkedAt: string;
  totalItems: number;
  anomalyCount: number;
  anomalies: ReconcileItemDTO[];
  items: ReconcileItemDTO[];
}

async function reconcileInventory(): Promise<ReconcileResult> {
  const { rows } = await inventoryRepository.findMany({}, 0, 100_000);
  const itemIds = rows.map((r) => r.itemId);
  const sums = await reservationRepository.getMovementSumsBatch(itemIds);

  const items: ReconcileItemDTO[] = rows.map((row) => {
    const s = sums.get(row.itemId) ?? { out: 0, in: 0 };
    const outstanding = s.out - s.in;
    const onHand = row.quantityTotal - row.quantityDamaged - outstanding;
    const flags: string[] = [];
    if (outstanding < 0) flags.push('INBOUND vượt OUTBOUND (thu hồi nhiều hơn đã xuất)');
    if (onHand < 0) flags.push('Tồn vật lý âm (đã xuất vượt tồn sở hữu)');
    if (row.quantityDamaged > row.quantityTotal) flags.push('Hỏng vượt tổng sở hữu');
    return {
      itemId: row.itemId,
      itemName: row.item.itemName,
      quantityTotal: row.quantityTotal,
      quantityDamaged: row.quantityDamaged,
      outbound: s.out,
      inbound: s.in,
      outstanding,
      onHand,
      flags,
    };
  });

  const anomalies = items.filter((i) => i.flags.length > 0);
  return {
    checkedAt: new Date().toISOString(),
    totalItems: items.length,
    anomalyCount: anomalies.length,
    anomalies,
    items,
  };
}

// ============================================================================
// TIMELINE THIẾT BỊ (Phase 7 #3) — reservation của MỌI item trong [from,to], gom theo item, cờ over-committed.
// ============================================================================
export interface TimelineReservationDTO {
  reservationId: string;
  orderId: string | null;
  orderCode: string | null;
  customerName: string | null;
  quantity: number;
  startAt: string;
  endAt: string;
  status: string;
}
export interface TimelineItemDTO {
  itemId: string;
  itemName: string;
  itemCode: string;
  quantityTotal: number;
  quantityDamaged: number;
  capacity: number; // total − damaged
  maxConcurrent: number; // đỉnh reservation chồng nhau trong khoảng
  overCommitted: boolean; // maxConcurrent > capacity
  reservations: TimelineReservationDTO[];
}
export interface EquipmentTimelineResult {
  from: string;
  to: string;
  items: TimelineItemDTO[];
}

/** Đỉnh số lượng reservation chồng nhau (sweep-line trên [startAt,endAt] có quantity). */
function maxConcurrentQuantity(reservations: { startAt: Date; endAt: Date; quantity: number }[]): number {
  const events: { t: number; delta: number }[] = [];
  for (const r of reservations) {
    events.push({ t: r.startAt.getTime(), delta: r.quantity });
    events.push({ t: r.endAt.getTime(), delta: -r.quantity });
  }
  // Sắp theo thời điểm; tại cùng mốc, xử lý kết thúc (-) TRƯỚC bắt đầu (+) để không tính chồng ở điểm tiếp giáp.
  events.sort((a, b) => (a.t !== b.t ? a.t - b.t : a.delta - b.delta));
  let running = 0;
  let max = 0;
  for (const e of events) {
    running += e.delta;
    if (running > max) max = running;
  }
  return max;
}

async function listReservationsTimeline(from: Date, to: Date, categoryId?: string): Promise<EquipmentTimelineResult> {
  const rows = await reservationRepository.listReservationsInRange(from, to, { categoryId });

  const byItem = new Map<string, TimelineItemDTO>();
  for (const r of rows) {
    let entry = byItem.get(r.itemId);
    if (!entry) {
      entry = {
        itemId: r.itemId,
        itemName: r.item.itemName,
        itemCode: r.item.itemCode,
        quantityTotal: 0,
        quantityDamaged: 0,
        capacity: 0,
        maxConcurrent: 0,
        overCommitted: false,
        reservations: [],
      };
      byItem.set(r.itemId, entry);
    }
    entry.reservations.push({
      reservationId: r.reservationId,
      orderId: r.orderId,
      orderCode: r.order ? r.order.orderCode : null,
      customerName: r.order ? r.order.customer.customerName : null,
      quantity: r.quantity,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      status: r.status,
    });
  }

  // Bơm capacity (total − damaged) cho các item xuất hiện + tính over-committed.
  const itemIds = [...byItem.keys()];
  if (itemIds.length > 0) {
    const invRows = await inventoryRepository.findManyByItemIds(itemIds);
    const invMap = new Map(invRows.map((i) => [i.itemId, i]));
    for (const entry of byItem.values()) {
      const inv = invMap.get(entry.itemId);
      entry.quantityTotal = inv?.quantityTotal ?? 0;
      entry.quantityDamaged = inv?.quantityDamaged ?? 0;
      entry.capacity = entry.quantityTotal - entry.quantityDamaged;
      entry.maxConcurrent = maxConcurrentQuantity(
        entry.reservations.map((x) => ({ startAt: new Date(x.startAt), endAt: new Date(x.endAt), quantity: x.quantity })),
      );
      entry.overCommitted = entry.maxConcurrent > entry.capacity;
    }
  }

  const items = [...byItem.values()].sort((a, b) => {
    if (a.overCommitted !== b.overCommitted) return a.overCommitted ? -1 : 1; // over-committed lên đầu
    return a.itemName.localeCompare(b.itemName, 'vi');
  });

  return { from: from.toISOString(), to: to.toISOString(), items };
}

export const inventoryService = {
  listInventory,
  reconcileInventory,
  listReservationsTimeline,
  getInventoryByItemId,
  createInventory,
  listMovements,
  getPicklist,
  adjustInventory,
  repairInventory,
  scrapInventory,
  listItemReservations,
  listReports,
  getReportById,
  createReport,
  confirmReport,
  recordFieldOutbound,
};
