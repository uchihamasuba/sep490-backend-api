import type { ActiveStatus, Supplier } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import {
  supplierRepository,
  supplierTransactionRepository,
  type SupplierTransactionWithDetails,
} from './supplier.repository';
import type {
  CreateSupplierBody,
  ListSupplierTransactionsQuery,
  ListSuppliersQuery,
  UpdateSupplierBody,
} from './supplier.validators';

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

export const supplierService = {
  listSuppliers,
  createSupplier,
  getSupplierById,
  updateSupplier,
  listSupplierTransactions,
};
