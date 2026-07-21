import type { Deposit, OrderStatus, Settlement } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { customerRepository } from './customer.repository';
import { quotationRepository } from './quotation.repository';
import {
  DEFAULT_LIVE_SHOW_CHECKLIST,
  InsufficientStockError,
  orderPicklistRepository,
  orderRepository,
  type ExportEquipmentTargetLine,
  type LiveShowChecklist,
  type OrderForPicklist,
  type OrderLineInput,
  type OrderWithDetails,
} from './order.repository';
import type {
  CloseOrderBody,
  ConfirmPreparedItemsBody,
  CreateDepositBody,
  CreateOrderBody,
  CreateSettlementBody,
  ListOrdersQuery,
  ListPicklistsQuery,
  UpdateLiveChecklistBody,
  UpdateOrderItemBody,
  UpdateOrderQuotationBody,
  UpdateOrderStatusBody,
} from './order.validators';

const TERMINAL_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED'];
// Đã chốt (thay cho DELETE cứng không giới hạn — docs/api/danhsachdondat_api.md mục 4 khuyến nghị dùng
// PUT .../status CANCELLED thay vì xóa): chỉ cho xóa cứng khi đơn CHƯA có hoạt động nghiệp vụ nào gắn
// theo (NEW) hoặc ĐÃ hủy (CANCELLED) — tránh mất dữ liệu của đơn đang/đã vận hành thật.
const DELETABLE_STATUSES: OrderStatus[] = ['NEW', 'CANCELLED'];

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
  closedAt: string | null;
  closedBy: string | null;
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

export interface OrderStatsDTO {
  all: number;
  new: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface OrderSurveyDTO {
  surveyId: string;
  reportCode: string;
  status: string;
  surveyDate: string;
  location: string;
  reportedByName: string;
  confirmedByName: string | null;
  confirmedAt: string | null;
}

export interface DepositDTO {
  depositId: string;
  depositCode: string;
  orderId: string;
  amount: number;
  dueDate: string | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  qrCodeUrl: string | null;
  status: string;
  evidenceId: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementDTO {
  settlementId: string;
  orderId: string;
  additionalFee: number;
  compensation: number;
  discount: number;
  finalAmount: number;
  paymentMethod: string | null;
  qrCodeUrl: string | null;
  paidAt: string | null;
  evidenceId: string | null;
  status: string;
  requestedBy: string | null;
  requestedAt: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    closedBy: row.closedBy,
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
    notes: body.notes || null,
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

async function deleteOrder(orderId: string): Promise<void> {
  const existing = await findOrderOrThrow(orderId);
  if (!DELETABLE_STATUSES.includes(existing.orderStatus)) {
    throw AppError.badRequest(
      `Không thể xóa đơn đang ở trạng thái ${existing.orderStatus} — chỉ xóa được đơn NEW hoặc CANCELLED, các đơn khác hãy dùng hủy đơn (PUT /orders/:orderId/status)`,
    );
  }
  await orderRepository.delete(orderId);
}

// GET /orders/stats — 6 thẻ KPI ở docs/api/danhsachdondat_api.md mục 2, tái dùng countByStatusGlobal đã
// có sẵn (cùng số liệu dùng cho meta.counts của GET /orders) thay vì query riêng.
async function getOrderStats(): Promise<OrderStatsDTO> {
  return orderRepository.countByStatusGlobal();
}

function mapSurvey(row: {
  surveyId: string;
  reportCode: string;
  status: string;
  surveyDate: Date;
  location: string;
  reporter: { fullName: string };
  confirmer: { fullName: string } | null;
  confirmedAt: Date | null;
}): OrderSurveyDTO {
  return {
    surveyId: row.surveyId,
    reportCode: row.reportCode,
    status: row.status,
    surveyDate: row.surveyDate.toISOString(),
    location: row.location,
    reportedByName: row.reporter.fullName,
    confirmedByName: row.confirmer?.fullName ?? null,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
  };
}

async function getOrderSurvey(orderId: string): Promise<OrderSurveyDTO | null> {
  await findOrderOrThrow(orderId);
  const survey = await orderRepository.findLatestSurvey(orderId);
  return survey ? mapSurvey(survey) : null;
}

function mapDeposit(row: Deposit): DepositDTO {
  return {
    depositId: row.depositId,
    depositCode: row.depositCode,
    orderId: row.orderId,
    amount: toNumber(row.amount),
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    paymentDate: row.paymentDate ? row.paymentDate.toISOString() : null,
    paymentMethod: row.paymentMethod,
    qrCodeUrl: row.qrCodeUrl,
    status: row.status,
    evidenceId: row.evidenceId,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOrderDeposits(orderId: string): Promise<DepositDTO[]> {
  await findOrderOrThrow(orderId);
  const rows = await orderRepository.findDeposits(orderId);
  return rows.map(mapDeposit);
}

function mapSettlement(row: Settlement): SettlementDTO {
  return {
    settlementId: row.settlementId,
    orderId: row.orderId,
    additionalFee: toNumber(row.additionalFee),
    compensation: toNumber(row.compensation),
    discount: toNumber(row.discount),
    finalAmount: toNumber(row.finalAmount),
    paymentMethod: row.paymentMethod,
    qrCodeUrl: row.qrCodeUrl,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    evidenceId: row.evidenceId,
    status: row.status,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt ? row.requestedAt.toISOString() : null,
    confirmedBy: row.confirmedBy,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOrderSettlement(orderId: string): Promise<SettlementDTO | null> {
  await findOrderOrThrow(orderId);
  const settlement = await orderRepository.findLatestSettlement(orderId);
  return settlement ? mapSettlement(settlement) : null;
}

async function updateOrderItem(orderId: string, orderItemId: string, body: UpdateOrderItemBody): Promise<OrderDetailDTO> {
  const existing = await findOrderOrThrow(orderId);
  assertNotTerminal(existing);

  const item = await orderRepository.findOrderItem(orderId, orderItemId);
  if (!item) throw AppError.notFound('Order item not found');

  const updated = await orderRepository.updateItem(orderId, orderItemId, body);
  return mapDetail(updated);
}

// Mốc 4 "Live Show" (docs/api/tiendosukien_api.md mục 5) — checklist { key, checked }, luôn merge với
// bản hiện tại (không có sẵn -> dùng mặc định toàn false) rồi trả lại object đầy đủ 4 khóa.
async function updateLiveChecklist(orderId: string, body: UpdateLiveChecklistBody): Promise<LiveShowChecklist> {
  const existing = await findOrderOrThrow(orderId);
  const current = (existing.liveShowChecklist as unknown as LiveShowChecklist | null) ?? DEFAULT_LIVE_SHOW_CHECKLIST;
  const nextChecklist: LiveShowChecklist = { ...current, [body.key]: body.checked };

  const updated = await orderRepository.updateLiveChecklist(orderId, nextChecklist);
  return (updated.liveShowChecklist as unknown as LiveShowChecklist) ?? nextChecklist;
}

// PATCH /orders/:orderId/quotation — liên kết/hủy liên kết báo giá (docs/api/baogiavahopdong_api.md mục
// 1.2/2 #4). Điều kiện hủy liên kết: khách hàng của đơn phải còn > 1 báo giá APPROVED (kể cả báo giá
// đang liên kết) để không biến đơn thành "mồ côi" hoàn toàn không còn báo giá thay thế nào.
async function updateOrderQuotation(orderId: string, body: UpdateOrderQuotationBody): Promise<OrderDetailDTO> {
  const existing = await findOrderOrThrow(orderId);

  if (body.quotationId !== null) {
    const quotation = await quotationRepository.findById(body.quotationId);
    if (!quotation) throw AppError.notFound('Quotation not found');
    if (quotation.status !== 'APPROVED') {
      throw AppError.badRequest('Chỉ được liên kết báo giá đã ở trạng thái APPROVED');
    }
    const linkedOrder = await quotationRepository.getLinkedOrderId(body.quotationId);
    if (linkedOrder && linkedOrder.orderId !== orderId) {
      throw AppError.conflict('Báo giá này đã được liên kết với một đơn hàng khác');
    }
  } else {
    if (!existing.quotationId) {
      throw AppError.badRequest('Đơn hàng chưa liên kết báo giá nào để hủy liên kết');
    }
    const approvedCount = await quotationRepository.countByCustomerAndStatus(existing.customerId, 'APPROVED');
    if (approvedCount <= 1) {
      throw AppError.badRequest(
        'Khách hàng chỉ có 1 báo giá đã duyệt — không thể hủy liên kết vì đơn sẽ không còn phương án thay thế',
      );
    }
  }

  const updated = await orderRepository.updateQuotationId(orderId, body.quotationId);
  return mapDetail(updated);
}

async function createDeposit(orderId: string, body: CreateDepositBody, requestedBy: string): Promise<DepositDTO> {
  const existing = await findOrderOrThrow(orderId);
  assertNotTerminal(existing);

  const depositCode = await orderRepository.generateNextDepositCode();
  const created = await orderRepository.createDeposit({
    depositCode,
    orderId,
    amount: body.amount,
    dueDate: body.dueDate ?? null,
    paymentMethod: body.paymentMethod ?? null,
    qrCodeUrl: body.qrCodeUrl ?? null,
    notes: body.notes || null,
    requestedBy,
  });
  return mapDeposit(created);
}

// POST /orders/:orderId/settlement — backend tự tính finalAmount, không tin số FE gửi (docs/api/
// tiendosukien_api.md mục 6): finalAmount = totalAmount + additionalFee + compensation - discount -
// tổng deposit đã SUCCESS. Nếu đã có 1 settlement DRAFT cho đơn này thì cập nhật lại (điều chỉnh), thay
// vì tạo thêm dòng mới mỗi lần Manager sửa số trước khi xác nhận.
async function createSettlement(orderId: string, body: CreateSettlementBody, requestedBy: string): Promise<{ settlementId: string }> {
  const existing = await findOrderOrThrow(orderId);

  const depositSum = await orderRepository.sumDepositsByStatus(orderId, 'SUCCESS');
  const successfulDeposits = toNumber(depositSum._sum.amount);
  const finalAmount =
    toNumber(existing.totalAmount) + body.additionalFee + body.compensation - body.discount - successfulDeposits;

  const latest = await orderRepository.findLatestSettlement(orderId);
  const payload = {
    orderId,
    additionalFee: body.additionalFee,
    compensation: body.compensation,
    discount: body.discount,
    finalAmount,
    paymentMethod: body.paymentMethod ?? null,
    qrCodeUrl: body.qrCodeUrl ?? null,
    notes: body.notes || null,
    requestedBy,
  };

  const settlement =
    latest && latest.status === 'DRAFT'
      ? await orderRepository.updateSettlementDraft(latest.settlementId, payload)
      : await orderRepository.createSettlement(payload);

  return { settlementId: settlement.settlementId };
}

async function closeOrder(orderId: string, closedBy: string, _body: CloseOrderBody): Promise<OrderDetailDTO> {
  const existing = await findOrderOrThrow(orderId);

  if (existing.orderStatus !== 'COMPLETED' || existing.paymentStatus !== 'PAID') {
    throw AppError.badRequest('Chỉ đóng được đơn đã COMPLETED và đã thanh toán đủ (PAID)');
  }
  if (existing.closedAt) {
    throw AppError.badRequest('Đơn hàng đã được đóng trước đó');
  }

  const updated = await orderRepository.close(orderId, closedBy);
  return mapDetail(updated);
}

async function confirmPreparedItems(orderId: string, body: ConfirmPreparedItemsBody): Promise<OrderDetailDTO> {
  const existing = await findOrderOrThrow(orderId);
  assertNotTerminal(existing);

  const existingItemIds = new Set(existing.orderItems.map((item) => item.orderItemId));
  const missingIds = body.items.map((line) => line.orderItemId).filter((id) => !existingItemIds.has(id));
  if (missingIds.length > 0) {
    throw AppError.badRequest('Một hoặc nhiều orderItemId không thuộc đơn hàng này', { orderItemIds: missingIds });
  }

  const updated = await orderRepository.confirmPreparedQty(orderId, body.items);
  return mapDetail(updated);
}

export interface ExportEquipmentResultDTO {
  orderId: string;
  orderCode: string;
  syncedQuotationId: string;
  syncedQuotationCode: string;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
  movements: { itemId: string; itemName: string; quantity: number; movementType: 'OUTBOUND' | 'INBOUND' }[];
  skippedSupplierItems: { itemId: string; itemName: string; quantity: number }[];
  unchanged: boolean;
}

// Xuất thiết bị v2 — reconcile theo báo giá liên kết (docs/api/xuatthietbi_tubaogia_api.md, bản
// "CẬP NHẬT LẦN 2"): đồng bộ order_items theo quotation_items rồi xuất bù/thu hồi chênh lệch tồn kho.
// Bấm lặp lại là hành vi hợp lệ (không còn 409 idempotency); no-op trả unchanged: true. Vẫn khác chủ
// đích với markPicklistPickedUp: chấp nhận đơn NEW, không yêu cầu preparedQty đủ (mục 4.2).
async function exportEquipment(
  orderId: string,
  performedBy: string,
  notes: string | null,
): Promise<ExportEquipmentResultDTO> {
  const existing = await findOrderOrThrow(orderId);

  if (TERMINAL_STATUSES.includes(existing.orderStatus)) {
    throw AppError.conflict(`Đơn hàng đang ở trạng thái ${existing.orderStatus} (đã kết thúc), không thể xuất thiết bị`);
  }
  if (!existing.quotationId) {
    throw AppError.conflict('Đơn chưa liên kết báo giá');
  }

  const quotation = await quotationRepository.findById(existing.quotationId);
  if (!quotation) {
    throw AppError.conflict('Báo giá liên kết không còn tồn tại');
  }

  // Gộp phòng thủ theo itemId (báo giá về nguyên tắc không có 2 dòng cùng item, nhưng nếu có thì
  // cộng dồn thay vì để Map nuốt mất dòng trước) — dùng snapshot itemName của quotation_items.
  const targetByItem = new Map<string, ExportEquipmentTargetLine>();
  for (const line of quotation.items) {
    const prev = targetByItem.get(line.itemId);
    if (prev) {
      prev.quantity += line.quantity;
      prev.subtotal += Number(line.lineTotal);
    } else {
      targetByItem.set(line.itemId, {
        itemId: line.itemId,
        itemName: line.itemName,
        quantity: line.quantity,
        unitPrice: Number(line.price),
        subtotal: Number(line.lineTotal),
      });
    }
  }
  const targetLines = [...targetByItem.values()];

  try {
    const result = await orderRepository.exportEquipment({
      orderId,
      performedBy,
      notes,
      quotationCode: quotation.quotationCode,
      targetLines,
    });

    return {
      orderId: result.order.orderId,
      orderCode: result.order.orderCode,
      syncedQuotationId: quotation.quotationId,
      syncedQuotationCode: quotation.quotationCode,
      pickedUpAt: result.order.pickedUpAt ? result.order.pickedUpAt.toISOString() : null,
      pickedUpBy: result.order.pickedUpBy,
      movements: result.movements,
      skippedSupplierItems: result.order.orderItems
        .filter((line) => line.source === 'SUPPLIER')
        .map((line) => ({ itemId: line.itemId, itemName: line.item.itemName, quantity: line.quantity })),
      unchanged: result.movements.length === 0 && !result.itemsChanged,
    };
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      throw AppError.badRequest('Tồn kho không đủ để xuất thiết bị', { items: err.items });
    }
    throw err;
  }
}

export interface PicklistItemDTO {
  orderId: string;
  orderCode: string;
  customerName: string;
  eventDate: string;
  coordinatorName: string | null;
  totalItemsCount: number;
  preparedItemsCount: number;
  pickedUpAt: string | null;
  pickedUpByName: string | null;
}

export interface PicklistListMeta {
  page: number;
  limit: number;
  totalCount: number;
  readyCount: number;
  exportedCount: number;
}

// "Sẵn sàng xuất kho" — không có cột `items_confirmed_at` riêng trong schema thật hiện tại, dùng công
// thức tổng hợp trực tiếp trên order_items (docs/api/picklistxuatkho_api.md mục 6, phương án fallback
// khi chưa có cột xác nhận riêng): mọi dòng đã prepared đủ số lượng và đơn có ít nhất 1 dòng.
function isReadyToPickUp(order: { pickedUpAt: Date | null; orderItems: { quantity: number; preparedQty: number }[] }): boolean {
  if (order.pickedUpAt) return false;
  if (order.orderItems.length === 0) return false;
  return order.orderItems.every((item) => item.preparedQty >= item.quantity);
}

function mapPicklistItem(row: OrderForPicklist, coordinatorName: string | null): PicklistItemDTO {
  const totalItemsCount = row.orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const preparedItemsCount = row.orderItems.reduce((sum, item) => sum + item.preparedQty, 0);
  return {
    orderId: row.orderId,
    orderCode: row.orderCode,
    customerName: row.customer.customerName,
    eventDate: row.eventDate.toISOString(),
    coordinatorName,
    totalItemsCount,
    preparedItemsCount,
    pickedUpAt: row.pickedUpAt ? row.pickedUpAt.toISOString() : null,
    pickedUpByName: row.pickedUpByUser ? row.pickedUpByUser.fullName : null,
  };
}

async function listPicklists(query: ListPicklistsQuery): Promise<{ data: PicklistItemDTO[]; meta: PicklistListMeta }> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [{ rows, totalItems: _ignoredPagedTotal }, allForCounts] = await Promise.all([
    orderPicklistRepository.findMany({ search: query.search, exportStatus: query.exportStatus, skip, take: limit }),
    orderPicklistRepository.findAllForCounts(query.search),
  ]);
  void _ignoredPagedTotal;

  const coordinators = await orderPicklistRepository.findLeadCoordinatorsByOrderIds(rows.map((r) => r.orderId));

  const totalCount = allForCounts.length;
  const exportedCount = allForCounts.filter((o) => o.pickedUpAt !== null).length;
  const readyCount = allForCounts.filter((o) => isReadyToPickUp(o)).length;

  return {
    data: rows.map((row) => mapPicklistItem(row, coordinators.get(row.orderId) ?? null)),
    meta: { page, limit, totalCount, readyCount, exportedCount },
  };
}

async function markPicklistPickedUp(orderId: string, pickedUpBy: string): Promise<PicklistItemDTO> {
  const existing = await findOrderOrThrow(orderId);

  if (existing.orderStatus !== 'CONFIRMED' && existing.orderStatus !== 'IN_PROGRESS') {
    throw AppError.conflict('Chỉ đơn CONFIRMED hoặc IN_PROGRESS mới có thể xuất kho');
  }
  if (existing.pickedUpAt) {
    throw AppError.conflict('Đơn hàng đã được đánh dấu xuất kho trước đó');
  }
  if (!isReadyToPickUp({ pickedUpAt: existing.pickedUpAt, orderItems: existing.orderItems })) {
    throw AppError.badRequest('Cần chuẩn bị đủ số lượng thiết bị (preparedQty >= quantity cho mọi dòng) trước khi xuất kho');
  }

  const updated = await orderRepository.markPickedUp(orderId, pickedUpBy);
  const coordinators = await orderPicklistRepository.findLeadCoordinatorsByOrderIds([orderId]);
  return mapPicklistItem(updated, coordinators.get(orderId) ?? null);
}

export const orderService = {
  listOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateOrderItems,
  deleteOrder,
  getOrderStats,
  getOrderSurvey,
  getOrderDeposits,
  getOrderSettlement,
  updateOrderItem,
  updateLiveChecklist,
  updateOrderQuotation,
  createDeposit,
  createSettlement,
  closeOrder,
  confirmPreparedItems,
  exportEquipment,
  listPicklists,
  markPicklistPickedUp,
};
