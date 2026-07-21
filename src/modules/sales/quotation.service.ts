import type { Item, QuotationStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { customerRepository } from './customer.repository';
import {
  computeQuotationLines,
  quotationRepository,
  type QuotationLineInput,
  type QuotationWithDetails,
} from './quotation.repository';
import type {
  CreateQuotationBody,
  ListCustomerQuotationsQuery,
  ListQuotationsQuery,
  UpdateQuotationBody,
} from './quotation.validators';

export type ApiQuotationStatus = 'draft' | 'approved' | 'rejected';

const STATUS_TO_DB: Record<ApiQuotationStatus, QuotationStatus> = {
  draft: 'DRAFT',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

const STATUS_TO_API: Record<QuotationStatus, ApiQuotationStatus> = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export interface QuotationListItemDTO {
  quotationId: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  version: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  status: ApiQuotationStatus;
  createdAt: string;
}

export interface QuotationItemDTO {
  quotationItemId: string;
  itemId: string;
  itemName: string;
  categoryName: string | null;
  unit: string;
  quantity: number;
  price: number;
  discount: number;
  lineTotal: number;
}

export interface QuotationDetailDTO {
  quotationId: string;
  quotationCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string | null;
  version: string;
  subtotal: number;
  discountTotal: number;
  totalAmount: number;
  status: ApiQuotationStatus;
  notes: string | null;
  createdBy: { userId: string; fullName: string; role: string };
  createdAt: string;
  updatedAt: string;
  linkedOrderId: string | null;
  items: QuotationItemDTO[];
}

export interface QuotationListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  counts: { all: number; draft: number; approved: number; rejected: number; approvedValue: number };
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function mapListItem(row: {
  quotationId: string;
  quotationCode: string;
  customerId: string;
  version: string;
  subtotal: unknown;
  discountTotal: unknown;
  totalAmount: unknown;
  status: QuotationStatus;
  createdAt: Date;
  customer: { customerName: string; phone: string };
}): QuotationListItemDTO {
  return {
    quotationId: row.quotationId,
    code: row.quotationCode,
    customerId: row.customerId,
    customerName: row.customer.customerName,
    customerPhone: row.customer.phone,
    version: row.version,
    subtotal: toNumber(row.subtotal),
    discount: toNumber(row.discountTotal),
    totalAmount: toNumber(row.totalAmount),
    status: STATUS_TO_API[row.status],
    createdAt: row.createdAt.toISOString(),
  };
}

function mapDetail(row: QuotationWithDetails, linkedOrderId: string | null): QuotationDetailDTO {
  return {
    quotationId: row.quotationId,
    quotationCode: row.quotationCode,
    customerId: row.customerId,
    customerName: row.customer.customerName,
    customerPhone: row.customer.phone,
    customerEmail: row.customer.email ?? '',
    customerAddress: row.customer.address,
    version: row.version,
    subtotal: toNumber(row.subtotal),
    discountTotal: toNumber(row.discountTotal),
    totalAmount: toNumber(row.totalAmount),
    status: STATUS_TO_API[row.status],
    notes: row.notes,
    createdBy: { userId: row.creator.userId, fullName: row.creator.fullName, role: row.creator.role },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    linkedOrderId,
    items: row.items.map((item) => ({
      quotationItemId: item.quotationItemId,
      itemId: item.itemId,
      itemName: item.itemName,
      categoryName: item.item.type.category.categoryName,
      unit: item.item.unit,
      quantity: item.quantity,
      price: toNumber(item.price),
      discount: toNumber(item.discount),
      lineTotal: toNumber(item.lineTotal),
    })),
  };
}

// Xác thực itemId có thật trong catalog + không có dòng nào bị chiết khấu vượt giá trị hàng hóa
// (lineTotal < 0) TRƯỚC KHI gọi repository ghi DB — validate ở service, tính toán ở repository.
async function resolveAndValidateLines(
  items: QuotationLineInput[],
): Promise<{ itemsById: Map<string, Item> }> {
  const uniqueItemIds = Array.from(new Set(items.map((line) => line.itemId)));
  const foundItems = await quotationRepository.findItemsByIds(uniqueItemIds);
  const itemsById = new Map(foundItems.map((item) => [item.itemId, item]));

  const missingIds = uniqueItemIds.filter((id) => !itemsById.has(id));
  if (missingIds.length > 0) {
    throw AppError.badRequest('Một hoặc nhiều hạng mục không tồn tại trong catalog', {
      itemIds: missingIds,
    });
  }

  const lines = computeQuotationLines(items, itemsById);
  const negativeLine = lines.find((line) => line.lineTotal < 0);
  if (negativeLine) {
    throw AppError.badRequest(
      `Chiết khấu của hạng mục "${negativeLine.itemName}" vượt quá giá trị hàng hóa (quantity × price)`,
      { itemId: negativeLine.itemId },
    );
  }

  return { itemsById };
}

async function findQuotationOrThrow(quotationId: string): Promise<QuotationWithDetails> {
  const quotation = await quotationRepository.findById(quotationId);
  if (!quotation) throw AppError.notFound('Quotation not found');
  return quotation;
}

async function listQuotations(query: ListQuotationsQuery): Promise<{ data: QuotationListItemDTO[]; meta: QuotationListMeta }> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [{ rows, totalItems }, counts] = await Promise.all([
    quotationRepository.findMany({
      status: query.status ? STATUS_TO_DB[query.status] : undefined,
      search: query.search,
      customerId: query.customerId,
      skip,
      take: limit,
    }),
    quotationRepository.countByStatusGlobal(),
  ]);

  return {
    data: rows.map(mapListItem),
    meta: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      counts: {
        all: counts.all,
        draft: counts.draft,
        approved: counts.approved,
        rejected: counts.rejected,
        approvedValue: toNumber(counts.approvedValue),
      },
    },
  };
}

async function listQuotationsByCustomer(customerId: string, query: ListCustomerQuotationsQuery) {
  const customer = await customerRepository.findById(customerId);
  if (!customer) throw AppError.notFound('Customer not found');

  const { page, limit } = query;
  const skip = (page - 1) * limit;
  const { rows, totalItems } = await quotationRepository.findByCustomer(
    customerId,
    query.status ? STATUS_TO_DB[query.status] : undefined,
    skip,
    limit,
  );

  return {
    data: rows.map(mapListItem),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
}

async function getQuotationById(quotationId: string): Promise<QuotationDetailDTO> {
  const quotation = await findQuotationOrThrow(quotationId);
  const linkedOrder = await quotationRepository.getLinkedOrderId(quotationId);
  return mapDetail(quotation, linkedOrder?.orderId ?? null);
}

async function createQuotationForCustomer(
  customerId: string,
  body: CreateQuotationBody,
  createdByUserId: string,
): Promise<QuotationDetailDTO> {
  const customer = await customerRepository.findById(customerId);
  if (!customer) throw AppError.notFound('Customer not found');

  const { itemsById } = await resolveAndValidateLines(body.items);
  const quotationCode = await quotationRepository.generateNextQuotationCode();

  const created = await quotationRepository.create({
    customerId,
    version: body.version,
    notes: body.notes ?? null,
    createdBy: createdByUserId,
    quotationCode,
    itemInputs: body.items,
    itemsById,
  });

  return mapDetail(created, null);
}

async function updateQuotation(quotationId: string, body: UpdateQuotationBody): Promise<QuotationDetailDTO> {
  const existing = await findQuotationOrThrow(quotationId);

  if (existing.status === 'REJECTED') {
    throw AppError.badRequest('Không thể sửa báo giá đã bị từ chối');
  }

  if (existing.status === 'APPROVED') {
    const linkedOrder = await quotationRepository.getLinkedOrderId(quotationId);
    if (linkedOrder) {
      throw AppError.badRequest('Không thể sửa báo giá đã được chuyển thành đơn hàng');
    }
  }

  const { itemsById } = await resolveAndValidateLines(body.items);

  const updated = await quotationRepository.replaceItems({
    quotationId,
    version: body.version,
    notes: body.notes ?? null,
    itemInputs: body.items,
    itemsById,
  });

  const linkedOrder = await quotationRepository.getLinkedOrderId(quotationId);
  return mapDetail(updated, linkedOrder?.orderId ?? null);
}

async function updateQuotationStatus(quotationId: string, status: 'approved' | 'rejected'): Promise<QuotationDetailDTO> {
  const existing = await findQuotationOrThrow(quotationId);
  if (existing.status !== 'DRAFT') {
    throw AppError.badRequest('Chỉ có thể phê duyệt/từ chối báo giá đang ở trạng thái nháp (DRAFT)');
  }

  const updated = await quotationRepository.updateStatus(quotationId, STATUS_TO_DB[status]);
  const linkedOrder = await quotationRepository.getLinkedOrderId(quotationId);
  return mapDetail(updated, linkedOrder?.orderId ?? null);
}

async function deleteQuotation(quotationId: string): Promise<void> {
  const existing = await findQuotationOrThrow(quotationId);
  if (existing.status === 'APPROVED') {
    throw AppError.badRequest('Không thể xóa báo giá đã được duyệt (APPROVED)');
  }
  await quotationRepository.delete(quotationId);
}

export const quotationService = {
  listQuotations,
  listQuotationsByCustomer,
  getQuotationById,
  createQuotationForCustomer,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
};
