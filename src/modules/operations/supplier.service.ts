import type { ActiveStatus, Supplier } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import {
  supplierRepository,
  supplierTransactionRepository,
  type SupplierTransactionWithDetails,
  type SupplierTransactionWithItems,
} from './supplier.repository';
import { scheduleRepository } from './schedule.repository';
import type {
  CreateSupplierBody,
  ListSupplierTransactionsQuery,
  ListSuppliersQuery,
  ListSupplierItemsQuery,
  UpdateSupplierBody,
  AssignSupplierItemBody,
  UpdateSupplierItemBody,
  CreateSupplierTransactionBody,
  UpdateSupplierTransactionBody,
  ReceiveTransactionItemBody,
  UpdateSupplierTransactionStatusBody,
  UpdateSupplierTransactionPaymentStatusBody,
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

export interface SupplierItemDetailsDTO {
  supplierId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  typeId: string;
  rentalPrice: number;
  purchasePrice: number;
  isActive: boolean;
  minQuantity: number | null;
  supplierItemCode: string | null;
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

const paymentStatusMap: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  DEPOSITED: 'Đã đặt cọc',
  PAID: 'Đã thanh toán',
};

const transactionStatusMap: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

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
    paymentStatus: paymentStatusMap[row.paymentStatus] || row.paymentStatus,
    status: transactionStatusMap[row.status] || row.status,
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

// STAFF chỉ thao tác được trên transaction thuộc order của plan họ giữ vai trò LEAD (docs/api/api.md
// gap (h)/(i)) — MANAGER/ADMIN không bị giới hạn phạm vi này.
async function assertActorCanAccessTransaction(actor: Actor, orderId: string): Promise<void> {
  if (actor.role === 'STAFF') {
    const isLead = await scheduleRepository.isUserLeadOnOrder(actor.id, orderId);
    if (!isLead) {
      throw AppError.forbidden('Chỉ Leader giữ vai trò LEAD trong kế hoạch của đơn hàng này mới được thao tác');
    }
  }
}

async function findSupplierOrThrow(supplierId: string): Promise<Supplier> {
  const supplier = await supplierRepository.findById(supplierId);
  if (!supplier) throw AppError.notFound('Không tìm thấy nhà cung cấp');
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

  if (body.status === 'INACTIVE') {
    const sum = await supplierRepository.sumOutstandingForSupplier(supplierId);
    if (computeDebtBalance(sum) > 0) {
      throw new AppError(400, 'CANNOT_DEACTIVATE_WITH_DEBT', 'Không thể ngừng hoạt động nhà cung cấp đang có công nợ');
    }
  }

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

async function updateSupplierStatus(supplierId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<SupplierDTO> {
  await findSupplierOrThrow(supplierId);
  
  if (status === 'INACTIVE') {
    const sum = await supplierRepository.sumOutstandingForSupplier(supplierId);
    if (computeDebtBalance(sum) > 0) {
      throw new AppError(400, 'CANNOT_DEACTIVATE_WITH_DEBT', 'Không thể ngừng hoạt động nhà cung cấp đang có công nợ');
    }
  }

  const updated = await supplierRepository.update(supplierId, { status });
  const sum = await supplierRepository.sumOutstandingForSupplier(supplierId);
  return mapSupplier(updated, computeDebtBalance(sum));
}

async function getSupplierItems(supplierId: string, query: ListSupplierItemsQuery) {
  await findSupplierOrThrow(supplierId);
  
  const paginated = query.page !== undefined || query.limit !== undefined;
  const page = query.page ?? 1;
  const limit = query.limit ?? 500;
  const skip = paginated ? (page - 1) * limit : undefined;
  const take = paginated ? limit : undefined;

  const { rows, totalItems } = await supplierRepository.findItemsBySupplierId(supplierId, skip, take);
  const data = rows.map((si) => ({
    supplierId: si.supplierId,
    itemId: si.itemId,
    itemCode: si.item.itemCode,
    itemName: si.item.itemName,
    typeId: si.item.typeId,
    rentalPrice: toNumber(si.rentalPrice),
    purchasePrice: toNumber(si.purchasePrice),
    isActive: si.isActive,
    minQuantity: si.minQuantity,
    supplierItemCode: si.supplierItemCode,
    createdAt: si.createdAt.toISOString(),
    updatedAt: si.updatedAt.toISOString(),
  }));

  return {
    data,
    meta: paginated
      ? { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
      : { page: null, limit: null, totalItems, totalPages: null },
  };
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
  if (!transaction) throw AppError.notFound('Không tìm thấy giao dịch nhà cung cấp');

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
  if (!transaction) throw AppError.notFound('Không tìm thấy giao dịch nhà cung cấp');

  await assertActorCanAccessTransaction(actor, transaction.orderId);

  const item = transaction.items.find((i) => i.stItemId === stItemId);
  if (!item) throw AppError.notFound('Không tìm thấy dòng hàng trong giao dịch nhà cung cấp');

  if (body.receivedQuantity > item.quantity) {
    throw AppError.badRequest(`receivedQuantity không được vượt quá quantity đã đặt (${item.quantity})`);
  }

  const updated = await supplierTransactionRepository.updateItemReceivedQuantity(stItemId, body.receivedQuantity);
  return mapTransactionItem(updated);
}

async function deleteSupplier(supplierId: string): Promise<void> {
  const supplier = await supplierRepository.findById(supplierId);
  if (!supplier) throw AppError.notFound('Không tìm thấy nhà cung cấp');

  await supplierRepository.delete(supplierId);
}

async function assignItemToSupplier(supplierId: string, body: AssignSupplierItemBody): Promise<SupplierItemDetailsDTO> {
  await findSupplierOrThrow(supplierId);

  // Check if item exists in system
  const { prisma } = require('../../db/prisma');
  const item = await prisma.item.findUnique({ where: { itemId: body.itemId } });
  if (!item) throw AppError.notFound('Không tìm thấy mặt hàng');

  await supplierRepository.assignItem(supplierId, {
    supplierId,
    itemId: body.itemId,
    rentalPrice: body.rentalPrice,
    purchasePrice: body.purchasePrice,
    isActive: body.isActive,
    minQuantity: body.minQuantity,
    supplierItemCode: body.supplierItemCode,
  });

  const si = await prisma.supplierItem.findUnique({
    where: { supplierId_itemId: { supplierId, itemId: body.itemId } },
    include: { item: true },
  });

  return {
    supplierId: si!.supplierId,
    itemId: si!.itemId,
    itemCode: si!.item.itemCode,
    itemName: si!.item.itemName,
    typeId: si!.item.typeId,
    rentalPrice: toNumber(si!.item.rentalPrice),
    purchasePrice: toNumber(si!.purchasePrice),
    isActive: si!.isActive,
    minQuantity: si!.minQuantity,
    supplierItemCode: si!.supplierItemCode,
    createdAt: si!.createdAt.toISOString(),
    updatedAt: si!.updatedAt.toISOString(),
  };
}

async function updateSupplierItem(supplierId: string, itemId: string, body: UpdateSupplierItemBody): Promise<SupplierItemDetailsDTO> {
  await findSupplierOrThrow(supplierId);
  const { prisma } = require('../../db/prisma');
  
  const existing = await prisma.supplierItem.findUnique({ where: { supplierId_itemId: { supplierId, itemId } } });
  if (!existing) throw AppError.notFound('Nhà cung cấp chưa được gán mặt hàng này');

  await supplierRepository.updateItem(supplierId, itemId, {
    rentalPrice: body.rentalPrice !== undefined ? body.rentalPrice : undefined,
    purchasePrice: body.purchasePrice !== undefined ? body.purchasePrice : undefined,
    isActive: body.isActive !== undefined ? body.isActive : undefined,
    minQuantity: body.minQuantity !== undefined ? body.minQuantity : undefined,
    supplierItemCode: body.supplierItemCode !== undefined ? body.supplierItemCode : undefined,
  });

  const si = await prisma.supplierItem.findUnique({
    where: { supplierId_itemId: { supplierId, itemId } },
    include: { item: true },
  });

  return {
    supplierId: si!.supplierId,
    itemId: si!.itemId,
    itemCode: si!.item.itemCode,
    itemName: si!.item.itemName,
    typeId: si!.item.typeId,
    rentalPrice: toNumber(si!.rentalPrice),
    purchasePrice: toNumber(si!.purchasePrice),
    isActive: si!.isActive,
    minQuantity: si!.minQuantity,
    supplierItemCode: si!.supplierItemCode,
    createdAt: si!.createdAt.toISOString(),
    updatedAt: si!.updatedAt.toISOString(),
  };
}

async function removeSupplierItem(supplierId: string, itemId: string): Promise<void> {
  await findSupplierOrThrow(supplierId);
  const { prisma } = require('../../db/prisma');
  
  const existing = await prisma.supplierItem.findUnique({ where: { supplierId_itemId: { supplierId, itemId } } });
  if (!existing) throw AppError.notFound('Nhà cung cấp chưa được gán mặt hàng này');

  await supplierRepository.removeItem(supplierId, itemId);
}

async function getNextSupplierCode(): Promise<{ code: string }> {
  const code = await supplierRepository.generateNextSupplierCode();
  return { code };
}

async function createSupplierTransaction(body: CreateSupplierTransactionBody, actor: Actor): Promise<SupplierTransactionDetailDTO> {
  const { prisma } = require('../../db/prisma');
  
  await findSupplierOrThrow(body.supplierId);
  
  const order = await prisma.order.findUnique({ where: { orderId: body.orderId } });
  if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');
  
  await assertActorCanAccessTransaction(actor, body.orderId);

  // Validate items
  let estimatedCost = 0;
  const itemsToCreate = [];

  for (const itemInput of body.items) {
    const supplierItem = await prisma.supplierItem.findUnique({
      where: { supplierId_itemId: { supplierId: body.supplierId, itemId: itemInput.itemId } },
      include: { item: true },
    });

    if (!supplierItem || !supplierItem.isActive) {
      throw AppError.badRequest(`Hạng mục (itemId: ${itemInput.itemId}) không tồn tại hoặc đã ngừng cung cấp bởi nhà cung cấp này.`);
    }

    let unitCost = itemInput.unitCost;
    if (unitCost === undefined) {
      unitCost = body.transactionType === 'PURCHASE' ? toNumber(supplierItem.purchasePrice) : toNumber(supplierItem.rentalPrice);
    }

    const subtotal = itemInput.quantity * unitCost;
    estimatedCost += subtotal;

    itemsToCreate.push({
      itemId: itemInput.itemId,
      itemName: supplierItem.item.itemName,
      quantity: itemInput.quantity,
      unitCost,
      subtotal,
      notes: itemInput.notes,
    });
  }

  const transactionCode = await supplierTransactionRepository.generateNextTransactionCode();

  const transaction = await supplierTransactionRepository.createTransaction({
    transactionCode,
    supplierId: body.supplierId,
    orderId: body.orderId,
    transactionType: body.transactionType,
    serviceTitle: body.serviceTitle,
    estimatedCost,
    depositAmount: body.depositAmount,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
  }, itemsToCreate);

  return mapTransactionDetail(transaction!);
}

async function updateSupplierTransaction(transactionId: string, body: UpdateSupplierTransactionBody, actor: Actor): Promise<SupplierTransactionDetailDTO> {
  const { prisma } = require('../../db/prisma');
  const existingTx = await supplierTransactionRepository.findById(transactionId);
  if (!existingTx) throw AppError.notFound('Không tìm thấy giao dịch nhà cung cấp');

  await assertActorCanAccessTransaction(actor, existingTx.orderId);

  let estimatedCost = existingTx.estimatedCost;
  let itemsToCreate: any[] | undefined = undefined;

  if (body.items) {
    estimatedCost = new (require('decimal.js').Decimal)(0);
    itemsToCreate = [];

    for (const itemInput of body.items) {
      const supplierItem = await prisma.supplierItem.findUnique({
        where: { supplierId_itemId: { supplierId: existingTx.supplierId, itemId: itemInput.itemId } },
        include: { item: true },
      });

      if (!supplierItem || !supplierItem.isActive) {
        throw AppError.badRequest(`Hạng mục (itemId: ${itemInput.itemId}) không tồn tại hoặc đã ngừng cung cấp bởi nhà cung cấp này.`);
      }

      let unitCost = itemInput.unitCost;
      if (unitCost === undefined) {
        unitCost = existingTx.transactionType === 'PURCHASE' ? toNumber(supplierItem.purchasePrice) : toNumber(supplierItem.rentalPrice);
      }

      const subtotal = itemInput.quantity * unitCost;
      estimatedCost = estimatedCost.plus(subtotal);

      itemsToCreate.push({
        itemId: itemInput.itemId,
        itemName: supplierItem.item.itemName,
        quantity: itemInput.quantity,
        unitCost,
        subtotal,
        notes: itemInput.notes,
      });
    }
  }

  const updateData: any = {};
  if (body.serviceTitle !== undefined) updateData.serviceTitle = body.serviceTitle;
  if (body.depositAmount !== undefined) updateData.depositAmount = body.depositAmount;
  if (body.items) updateData.estimatedCost = estimatedCost;

  const transaction = await supplierTransactionRepository.updateTransaction(transactionId, updateData, itemsToCreate);
  return mapTransactionDetail(transaction!);
}

async function deleteSupplierTransaction(transactionId: string, actor: Actor): Promise<void> {
  const existingTx = await supplierTransactionRepository.findById(transactionId);
  if (!existingTx) throw AppError.notFound('Không tìm thấy giao dịch nhà cung cấp');

  await assertActorCanAccessTransaction(actor, existingTx.orderId);

  if (existingTx.status !== 'PENDING') {
    throw AppError.badRequest('Chỉ được xóa giao dịch ở trạng thái Chờ duyệt (PENDING). Vui lòng Hủy giao dịch nếu không còn sử dụng.');
  }

  await supplierTransactionRepository.deleteTransaction(transactionId);
}
async function updateTransactionStatus(transactionId: string, body: UpdateSupplierTransactionStatusBody, actor: Actor): Promise<SupplierTransactionDetailDTO> {
  const existingTx = await supplierTransactionRepository.findById(transactionId);
  if (!existingTx) throw AppError.notFound('Không tìm thấy giao dịch nhà cung cấp');

  await assertActorCanAccessTransaction(actor, existingTx.orderId);

  const updated = await supplierTransactionRepository.updateTransactionStatus(transactionId, body.status);
  return mapTransactionDetail(updated!);
}

async function updateTransactionPaymentStatus(transactionId: string, body: UpdateSupplierTransactionPaymentStatusBody, actor: Actor): Promise<SupplierTransactionDetailDTO> {
  const existingTx = await supplierTransactionRepository.findById(transactionId);
  if (!existingTx) throw AppError.notFound('Không tìm thấy giao dịch nhà cung cấp');

  await assertActorCanAccessTransaction(actor, existingTx.orderId);

  const updated = await supplierTransactionRepository.updateTransactionPaymentStatus(transactionId, body.paymentStatus);
  return mapTransactionDetail(updated!);
}

export const supplierService = {
  getSupplierById,
  listSuppliers,
  createSupplier,
  updateSupplier,
  updateSupplierStatus,
  deleteSupplier,
  getSupplierItems,
  assignItemToSupplier,
  updateSupplierItem,
  removeSupplierItem,
  getNextSupplierCode,
  listSupplierTransactions,
  getSupplierTransactionById,
  receiveTransactionItem,
  createSupplierTransaction,
  updateSupplierTransaction,
  deleteSupplierTransaction,
  updateTransactionStatus,
  updateTransactionPaymentStatus,
};
