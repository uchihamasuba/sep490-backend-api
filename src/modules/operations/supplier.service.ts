import type { ActiveStatus, Supplier } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import {
  supplierRepository,
  supplierTransactionRepository,
  type SupplierTransactionWithDetails,
  type SupplierTransactionWithItems,
} from './supplier.repository';
import type {
  CreateSupplierBody,
  ListSupplierTransactionsQuery,
  ListSuppliersQuery,
  ReceiveTransactionItemBody,
  UpdateSupplierBody,
} from './supplier.validators';
import type { Actor } from './schedule.service';

export interface SupplierDTO {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  rating: number | null;
  notes: string | null;
  status: ActiveStatus;
  debtBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface SupplierListResult {
  data: SupplierDTO[];
  meta: SupplierListMeta;
}

export interface SupplierTransactionDTO {
  transactionId: string;
  transactionCode: string;
  supplierId: string;
  supplierName: string;
  orderId: string;
  orderCode: string;
  transactionType: string;
  serviceTitle: string;
  estimatedCost: number;
  depositAmount: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierTransactionListResult {
  data: SupplierTransactionDTO[];
  meta: SupplierListMeta;
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

// debtBalance tính động từ supplier_transactions chưa CANCELLED và chưa thanh toán hết — hướng khuyến
// nghị ở docs/api/supplier_api.md mục 3.1 (không lưu cột riêng, tránh lệch dữ liệu theo thời gian).
// Schema DB thật của module này KHÔNG có compensationAmount/supplierDeduction/paidAmount như công thức
// doc đề cập (công thức đó dựa trên 1 thiết kế FE cũ, chưa khớp schema hiện tại) — dùng đúng 2 cột thật
// sẵn có trên supplier_transactions: estimatedCost - depositAmount.
function computeDebtBalance(sum: { estimatedCost: unknown; depositAmount: unknown } | null | undefined): number {
  if (!sum) return 0;
  const outstanding = toNumber(sum.estimatedCost) - toNumber(sum.depositAmount);
  return outstanding > 0 ? outstanding : 0;
}

function mapSupplier(row: Supplier, debtBalance: number): SupplierDTO {
  return {
    supplierId: row.supplierId,
    supplierCode: row.supplierCode,
    supplierName: row.supplierName,
    serviceType: row.serviceType,
    contactPerson: row.contactPerson,
    phone: row.phone,
    address: row.address,
    rating: row.rating === null ? null : Number(row.rating),
    notes: row.notes,
    status: row.status,
    debtBalance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapTransaction(row: SupplierTransactionWithDetails): SupplierTransactionDTO {
  return {
    transactionId: row.transactionId,
    transactionCode: row.transactionCode,
    supplierId: row.supplierId,
    supplierName: row.supplier.supplierName,
    orderId: row.orderId,
    orderCode: row.order.orderCode,
    transactionType: row.transactionType,
    serviceTitle: row.serviceTitle,
    estimatedCost: toNumber(row.estimatedCost),
    depositAmount: toNumber(row.depositAmount),
    paymentStatus: row.paymentStatus,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface SupplierTransactionItemDTO {
  stItemId: string;
  transactionId: string;
  itemId: string | null;
  itemName: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  receivedQuantity: number;
  notes: string | null;
}

export interface SupplierTransactionDetailDTO extends SupplierTransactionDTO {
  items: SupplierTransactionItemDTO[];
}

function mapTransactionItem(row: SupplierTransactionWithItems['items'][number]): SupplierTransactionItemDTO {
  return {
    stItemId: row.stItemId,
    transactionId: row.transactionId,
    itemId: row.itemId,
    itemName: row.itemName,
    quantity: row.quantity,
    unitCost: toNumber(row.unitCost),
    subtotal: toNumber(row.subtotal),
    receivedQuantity: row.receivedQuantity,
    notes: row.notes,
  };
}

function mapTransactionDetail(row: SupplierTransactionWithItems): SupplierTransactionDetailDTO {
  return {
    ...mapTransaction(row),
    items: row.items.map(mapTransactionItem),
  };
}

// LEADER chỉ thao tác được trên transaction thuộc order của plan họ được phân công (docs/api/api.md
// gap (h)/(i)) — MANAGER/ADMIN không bị giới hạn phạm vi này.
async function assertActorCanAccessTransaction(actor: Actor, orderId: string): Promise<void> {
  if (actor.role === 'LEADER') {
    const assigned = await supplierTransactionRepository.isUserAssignedToOrder(actor.id, orderId);
    if (!assigned) {
      throw AppError.forbidden('Bạn không được phân công vào kế hoạch nào của đơn hàng này');
    }
  }
}

async function findSupplierOrThrow(supplierId: string): Promise<Supplier> {
  const supplier = await supplierRepository.findById(supplierId);
  if (!supplier) throw AppError.notFound('Supplier not found');
  return supplier;
}

async function listSuppliers(query: ListSuppliersQuery): Promise<SupplierListResult> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const { rows, totalItems } = await supplierRepository.findMany({
    status: query.status,
    search: query.search,
    skip,
    take: limit,
  });

  const supplierIds = rows.map((row) => row.supplierId);
  const sums = await supplierRepository.sumOutstandingBySupplierIds(supplierIds);
  const sumMap = new Map(sums.map((s) => [s.supplierId, s._sum]));

  return {
    data: rows.map((row) => mapSupplier(row, computeDebtBalance(sumMap.get(row.supplierId)))),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
}

async function createSupplier(body: CreateSupplierBody): Promise<SupplierDTO> {
  const existing = await supplierRepository.findByCode(body.supplierCode);
  if (existing) {
    throw new AppError(409, 'SUPPLIER_CODE_ALREADY_EXISTS', 'Mã nhà cung cấp đã tồn tại trong hệ thống');
  }

  const created = await supplierRepository.create({
    supplierCode: body.supplierCode,
    supplierName: body.supplierName,
    serviceType: body.serviceType,
    phone: body.phone ?? null,
    address: body.address ?? null,
    contactPerson: body.contactPerson ?? null,
    rating: body.rating ?? null,
    notes: body.notes || null,
    status: body.status,
  });
  return mapSupplier(created, 0);
}

async function getSupplierById(supplierId: string): Promise<SupplierDTO> {
  const supplier = await findSupplierOrThrow(supplierId);
  const sum = await supplierRepository.sumOutstandingForSupplier(supplierId);
  return mapSupplier(supplier, computeDebtBalance(sum));
}

async function updateSupplier(supplierId: string, body: UpdateSupplierBody): Promise<SupplierDTO> {
  await findSupplierOrThrow(supplierId);

  const updated = await supplierRepository.update(supplierId, {
    ...(body.supplierName !== undefined ? { supplierName: body.supplierName } : {}),
    ...(body.serviceType !== undefined ? { serviceType: body.serviceType } : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.address !== undefined ? { address: body.address } : {}),
    ...(body.contactPerson !== undefined ? { contactPerson: body.contactPerson } : {}),
    ...(body.rating !== undefined ? { rating: body.rating } : {}),
    ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  });

  const sum = await supplierRepository.sumOutstandingForSupplier(supplierId);
  return mapSupplier(updated, computeDebtBalance(sum));
}

async function listSupplierTransactions(query: ListSupplierTransactionsQuery): Promise<SupplierTransactionListResult> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const { rows, totalItems } = await supplierTransactionRepository.findMany({
    supplierId: query.supplierId,
    orderId: query.orderId,
    status: query.status,
    skip,
    take: limit,
  });

  return {
    data: rows.map(mapTransaction),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
}

// GET /supplier-transactions/:id — chi tiết kèm items[] (docs/api/api.md gap (q)).
async function getSupplierTransactionById(transactionId: string, actor: Actor): Promise<SupplierTransactionDetailDTO> {
  const transaction = await supplierTransactionRepository.findById(transactionId);
  if (!transaction) throw AppError.notFound('Supplier transaction not found');

  await assertActorCanAccessTransaction(actor, transaction.orderId);
  return mapTransactionDetail(transaction);
}

// PATCH /supplier-transactions/:transactionId/items/:stItemId — xác nhận nhận hàng từng dòng (docs/api/
// api.md gap (i)). Không tự cộng inventory (INBOUND) khi PURCHASE nhận đủ — quyết định nghiệp vụ đó
// chưa chốt (xem ghi chú gap (i)), Manager vẫn xử lý nhập kho riêng qua POST /inventory/adjust.
async function receiveTransactionItem(
  transactionId: string,
  stItemId: string,
  body: ReceiveTransactionItemBody,
  actor: Actor,
): Promise<SupplierTransactionItemDTO> {
  const transaction = await supplierTransactionRepository.findById(transactionId);
  if (!transaction) throw AppError.notFound('Supplier transaction not found');

  await assertActorCanAccessTransaction(actor, transaction.orderId);

  const item = transaction.items.find((i) => i.stItemId === stItemId);
  if (!item) throw AppError.notFound('Supplier transaction item not found');

  if (body.receivedQuantity > item.quantity) {
    throw AppError.badRequest(`receivedQuantity không được vượt quá quantity đã đặt (${item.quantity})`);
  }

  const updated = await supplierTransactionRepository.updateItemReceivedQuantity(stItemId, body.receivedQuantity);
  return mapTransactionItem(updated);
}

export const supplierService = {
  listSuppliers,
  createSupplier,
  getSupplierById,
  updateSupplier,
  listSupplierTransactions,
  getSupplierTransactionById,
  receiveTransactionItem,
};
