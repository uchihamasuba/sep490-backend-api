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
import type {
  AdjustInventoryBody,
  CreateInventoryBody,
  CreateReportBody,
  ListInventoryQuery,
  ListMovementsQuery,
  ListReportsQuery,
  ReleaseInventoryBody,
  ReserveInventoryBody,
} from './inventory.validators';

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
  source: string;
  quantityOrdered: number;
  quantityAvailable: number | null;
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
}

export interface ListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

function mapInventory(row: InventoryWithItem): InventoryDTO {
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
    quantityReserved: row.quantityReserved,
    quantityAvailable: row.quantityAvailable,
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
  };
}

function toMeta(page: number, limit: number, totalItems: number): ListMeta {
  return { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) };
}

async function findInventoryOrThrow(itemId: string): Promise<InventoryWithItem> {
  const row = await inventoryRepository.findByItemId(itemId);
  if (!row) throw AppError.notFound('Inventory record not found for this item');
  return row;
}

async function listInventory(query: ListInventoryQuery): Promise<{ data: InventoryDTO[]; meta: ListMeta }> {
  const skip = (query.page - 1) * query.limit;
  const { rows, totalItems } = await inventoryRepository.findMany({ itemId: query.itemId, search: query.search }, skip, query.limit);
  return { data: rows.map(mapInventory), meta: toMeta(query.page, query.limit, totalItems) };
}

async function getInventoryByItemId(itemId: string): Promise<InventoryDTO> {
  const row = await findInventoryOrThrow(itemId);
  return mapInventory(row);
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
  if (!order) throw AppError.notFound('Order not found');

  const rows = await inventoryRepository.findOrderItemsForPicklist(orderId);
  return rows.map((row) => ({
    orderItemId: row.orderItemId,
    itemId: row.itemId,
    itemName: row.item.itemName,
    unit: row.item.unit,
    source: row.source,
    quantityOrdered: row.quantity,
    quantityAvailable: row.item.inventory ? row.item.inventory.quantityAvailable : null,
  }));
}

// POST /api/v1/inventory — khởi tạo dòng tồn kho cho 1 item chưa từng có (Inventory là quan hệ 1-1
// optional với Item, docs/api/more-require.md mục (b): item mới tạo chưa có tồn kho, cần nhập kho
// riêng). Không có endpoint nào khác tạo được dòng inventory đầu tiên — adjust/reserve/release đều yêu
// cầu dòng đã tồn tại (findInventoryOrThrow).
async function createInventory(body: CreateInventoryBody): Promise<InventoryDTO> {
  const item = await inventoryRepository.itemExists(body.itemId);
  if (!item) throw AppError.notFound('Item not found');

  const existing = await inventoryRepository.findByItemId(body.itemId);
  if (existing) throw AppError.conflict('Inventory record already exists for this item');

  if (body.quantityDamaged > body.quantityTotal) {
    throw AppError.badRequest('quantityDamaged must not exceed quantityTotal');
  }

  const created = await inventoryRepository.create({
    itemId: body.itemId,
    quantityTotal: body.quantityTotal,
    quantityDamaged: body.quantityDamaged,
    quantityAvailable: body.quantityTotal - body.quantityDamaged,
  });

  return mapInventory(created);
}

async function adjustInventory(body: AdjustInventoryBody, actorId: string): Promise<InventoryDTO> {
  const current = await findInventoryOrThrow(body.itemId);

  if (body.deltaTotal < 0 && current.quantityAvailable < Math.abs(body.deltaTotal)) {
    throw AppError.badRequest('Không đủ số lượng khả dụng để giảm tồn kho', {
      quantityAvailable: current.quantityAvailable,
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

  return mapInventory(updated);
}

// actorId nhận vào để đồng nhất chữ ký với các thao tác ghi khác (adjust/report) và sẵn sàng cho nhu
// cầu audit sau này — reserve/release hiện chưa ghi inventory_movements (đây là chuyển trạng thái nội
// bộ available<->reserved, không phải 1 dịch chuyển vật lý trong/ngoài kho như OUTBOUND/INBOUND/ADJUSTMENT).
async function reserveInventory(body: ReserveInventoryBody, _actorId: string): Promise<InventoryDTO> {
  const current = await findInventoryOrThrow(body.itemId);

  if (body.quantity > current.quantityAvailable) {
    throw AppError.badRequest('Không đủ số lượng khả dụng để giữ chỗ', {
      quantityAvailable: current.quantityAvailable,
      requested: body.quantity,
    });
  }

  if (body.orderId) {
    const order = await inventoryRepository.orderExists(body.orderId);
    if (!order) throw AppError.notFound('Order not found');
  }

  const updated = await inventoryRepository.reserve(body.itemId, body.quantity);
  return mapInventory(updated);
}

async function releaseInventory(body: ReleaseInventoryBody, _actorId: string): Promise<InventoryDTO> {
  const current = await findInventoryOrThrow(body.itemId);

  if (body.quantity > current.quantityReserved) {
    throw AppError.badRequest('Số lượng cần giải phóng vượt quá số lượng đang giữ chỗ', {
      quantityReserved: current.quantityReserved,
      requested: body.quantity,
    });
  }

  const updated = await inventoryRepository.release(body.itemId, body.quantity);
  return mapInventory(updated);
}

async function listReports(query: ListReportsQuery): Promise<{ data: ReportDTO[]; meta: ListMeta }> {
  const skip = (query.page - 1) * query.limit;
  const { rows, totalItems } = await inventoryRepository.findReports({ status: query.status, orderId: query.orderId }, skip, query.limit);
  return { data: rows.map(mapReport), meta: toMeta(query.page, query.limit, totalItems) };
}

async function findReportOrThrow(reportId: string): Promise<ReportWithDetails> {
  const report = await inventoryRepository.findReportById(reportId);
  if (!report) throw AppError.notFound('Collected equipment report not found');
  return report;
}

async function getReportById(reportId: string): Promise<ReportDTO> {
  const report = await findReportOrThrow(reportId);
  return mapReport(report);
}

async function createReport(body: CreateReportBody, reportedBy: string): Promise<ReportDTO> {
  const order = await inventoryRepository.orderExists(body.orderId);
  if (!order) throw AppError.notFound('Order not found');

  for (const line of body.items) {
    const item = await inventoryRepository.itemExists(line.itemId);
    if (!item) throw AppError.notFound(`Item not found: ${line.itemId}`, { itemId: line.itemId });
  }

  const created = await inventoryRepository.createReport({
    orderId: body.orderId,
    reportType: body.reportType,
    transactionId: body.transactionId ?? null,
    reportedBy,
    notes: body.notes || null,
    items: body.items.map((line) => ({
      itemId: line.itemId,
      goodQuantity: line.goodQuantity,
      damagedQuantity: line.damagedQuantity,
      lostQuantity: line.lostQuantity,
      notes: line.notes || null,
    })),
  });

  return mapReport(created);
}

// docs/api/api.md gap (k), đã chốt 2026-07-22: Leader tự xác nhận "đã trả kho/NCC" trên app, giới hạn
// theo order của plan họ được phân công (cùng mẫu assertActorCanAccessTransaction ở supplier.service.ts).
async function confirmReport(reportId: string, actor: Actor): Promise<ReportDTO> {
  const report = await findReportOrThrow(reportId);
  if (report.status !== 'SUBMITTED') {
    throw AppError.badRequest(`Chỉ có thể xác nhận báo cáo đang ở trạng thái SUBMITTED (hiện tại: ${report.status})`);
  }

  if (actor.role === 'LEADER') {
    const assigned = await inventoryRepository.isUserAssignedToOrder(actor.id, report.orderId);
    if (!assigned) {
      throw AppError.forbidden('Bạn không được phân công vào kế hoạch nào của đơn hàng này');
    }
  }

  for (const line of report.items) {
    if (line.lostQuantity <= 0) continue;
    const inv = await inventoryRepository.findByItemId(line.itemId);
    if (!inv) throw AppError.notFound(`Inventory record not found for item ${line.itemId}`);
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

  return mapReport(confirmed);
}

// POST /schedule-plans/:planId/warehouse-movement (docs/api/api.md gap (g)) — Leader ghi nhận xuất kho
// doanh nghiệp thực tế tại hiện trường (TSK-SETUP). Chỉ Leader giữ vai trò LEAD của đúng plan đó được
// gọi (không phải mọi assignee) — khớp gate `isLead` phía FE (WarehouseMovementSection).
async function recordFieldOutbound(planId: string, body: WarehouseMovementBody, actor: Actor): Promise<MovementDTO[]> {
  const plan = await scheduleRepository.findById(planId);
  if (!plan) throw AppError.notFound('Schedule plan not found');

  const isLeadAssignee = plan.assignees.some((a) => a.userId === actor.id && a.role === 'LEAD');
  if (!isLeadAssignee) {
    throw AppError.forbidden('Chỉ Leader giữ vai trò LEAD trong kế hoạch này mới được ghi nhận xuất kho');
  }

  for (const line of body.items) {
    const item = await inventoryRepository.itemExists(line.itemId);
    if (!item) throw AppError.notFound(`Item not found: ${line.itemId}`, { itemId: line.itemId });
  }

  try {
    const movements = await inventoryRepository.recordFieldOutbound({
      orderId: plan.orderId,
      performedBy: actor.id,
      notes: body.notes || null,
      items: body.items,
    });
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

export const inventoryService = {
  listInventory,
  getInventoryByItemId,
  createInventory,
  listMovements,
  getPicklist,
  adjustInventory,
  reserveInventory,
  releaseInventory,
  listReports,
  getReportById,
  createReport,
  confirmReport,
  recordFieldOutbound,
};
