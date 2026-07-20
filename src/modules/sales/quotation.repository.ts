import type { Item, Prisma, QuotationStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface QuotationLineInput {
  itemId: string;
  quantity: number;
  price: number;
  discount: number;
}

export interface QuotationLine {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  discount: number;
  lineTotal: number;
}

export interface QuotationTotals {
  subtotal: number;
  discountTotal: number;
  totalAmount: number;
}

export interface QuotationListFilter {
  status?: QuotationStatus;
  search?: string;
  customerId?: string;
}

export interface QuotationListParams extends QuotationListFilter {
  skip: number;
  take: number;
}

const detailInclude = {
  customer: { select: { customerName: true, phone: true, email: true, address: true } },
  creator: { select: { userId: true, fullName: true, role: true } },
  items: { include: { item: { include: { type: { include: { category: true } } } } } },
} satisfies Prisma.QuotationInclude;

export type QuotationWithDetails = Prisma.QuotationGetPayload<{ include: typeof detailInclude }>;

function buildWhere(filter: QuotationListFilter): Prisma.QuotationWhereInput {
  const where: Prisma.QuotationWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.customerId) where.customerId = filter.customerId;
  if (filter.search) {
    const q = filter.search;
    where.OR = [{ quotationCode: { contains: q } }, { customer: { customerName: { contains: q } } }];
  }
  return where;
}

// Ăn theo requirement: repository chịu trách nhiệm tính lineTotal/subtotal/discountTotal/totalAmount
// TRƯỚC KHI insert/update — quotation_items.line_total KHÔNG phải cột generated trong DB thật.
// discount ở đây đã là tổng giảm của cả dòng (FE nhân sẵn discount*quantity trước khi gửi — đã chốt ở
// docs/taobaogiamoi_api.md mục 3.4), nên KHÔNG nhân thêm quantity lần nữa ở đây.
export function computeQuotationLines(inputs: QuotationLineInput[], itemsById: Map<string, Item>): QuotationLine[] {
  return inputs.map((input) => {
    const item = itemsById.get(input.itemId);
    if (!item) throw new Error(`Item not found: ${input.itemId}`);
    return {
      itemId: input.itemId,
      itemName: item.itemName,
      quantity: input.quantity,
      price: input.price,
      discount: input.discount,
      lineTotal: input.quantity * input.price - input.discount,
    };
  });
}

export function computeQuotationTotals(lines: QuotationLine[]): QuotationTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const discountTotal = lines.reduce((sum, line) => sum + line.discount, 0);
  return { subtotal, discountTotal, totalAmount: subtotal - discountTotal };
}

export const quotationRepository = {
  async findItemsByIds(itemIds: string[]): Promise<Item[]> {
    if (itemIds.length === 0) return [];
    return prisma.item.findMany({ where: { itemId: { in: itemIds } } });
  },

  async generateNextQuotationCode(): Promise<string> {
    const count = await prisma.quotation.count();
    return `QUO-${String(count + 1).padStart(3, '0')}`;
  },

  async findMany(params: QuotationListParams) {
    const where = buildWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { customerName: true, phone: true } } },
      }),
      prisma.quotation.count({ where }),
    ]);
    return { rows, totalItems };
  },

  // Theo docs/danhsachbaogia_api.md mục 4.1: meta.counts KHÔNG bị ảnh hưởng bởi search/status/customerId
  // — luôn là số liệu toàn bộ bảng, dùng cho 5 thẻ KPI đầu trang.
  async countByStatusGlobal() {
    const [all, draft, approved, rejected, approvedAgg] = await Promise.all([
      prisma.quotation.count(),
      prisma.quotation.count({ where: { status: 'DRAFT' } }),
      prisma.quotation.count({ where: { status: 'APPROVED' } }),
      prisma.quotation.count({ where: { status: 'REJECTED' } }),
      prisma.quotation.aggregate({ where: { status: 'APPROVED' }, _sum: { totalAmount: true } }),
    ]);
    return { all, draft, approved, rejected, approvedValue: approvedAgg._sum.totalAmount };
  },

  findById(quotationId: string): Promise<QuotationWithDetails | null> {
    return prisma.quotation.findUnique({ where: { quotationId }, include: detailInclude });
  },

  getLinkedOrderId(quotationId: string) {
    return prisma.order.findFirst({ where: { quotationId }, select: { orderId: true } });
  },

  // Dùng cho điều kiện "hủy liên kết báo giá" ở docs/api/baogiavahopdong_api.md mục 1.2/2 #4 — khách
  // hàng phải còn > 1 báo giá APPROVED thì Manager mới được gỡ liên kết quotationId khỏi 1 đơn.
  countByCustomerAndStatus(customerId: string, status: QuotationStatus) {
    return prisma.quotation.count({ where: { customerId, status } });
  },

  async create(params: {
    customerId: string;
    version: string;
    notes: string | null;
    createdBy: string;
    quotationCode: string;
    itemInputs: QuotationLineInput[];
    itemsById: Map<string, Item>;
  }): Promise<QuotationWithDetails> {
    const lines = computeQuotationLines(params.itemInputs, params.itemsById);
    const totals = computeQuotationTotals(lines);

    return prisma.quotation.create({
      data: {
        quotationCode: params.quotationCode,
        customerId: params.customerId,
        version: params.version,
        notes: params.notes,
        createdBy: params.createdBy,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        totalAmount: totals.totalAmount,
        status: 'DRAFT',
        items: {
          create: lines.map((line) => ({
            itemId: line.itemId,
            itemName: line.itemName,
            quantity: line.quantity,
            price: line.price,
            discount: line.discount,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: detailInclude,
    });
  },

  async replaceItems(params: {
    quotationId: string;
    version: string;
    notes: string | null;
    itemInputs: QuotationLineInput[];
    itemsById: Map<string, Item>;
  }): Promise<QuotationWithDetails> {
    const lines = computeQuotationLines(params.itemInputs, params.itemsById);
    const totals = computeQuotationTotals(lines);

    return prisma.quotation.update({
      where: { quotationId: params.quotationId },
      data: {
        version: params.version,
        notes: params.notes,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        totalAmount: totals.totalAmount,
        items: {
          deleteMany: {},
          create: lines.map((line) => ({
            itemId: line.itemId,
            itemName: line.itemName,
            quantity: line.quantity,
            price: line.price,
            discount: line.discount,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: detailInclude,
    });
  },

  updateStatus(quotationId: string, status: QuotationStatus): Promise<QuotationWithDetails> {
    return prisma.quotation.update({ where: { quotationId }, data: { status }, include: detailInclude });
  },

  delete(quotationId: string) {
    return prisma.quotation.delete({ where: { quotationId } });
  },

  async findByCustomer(customerId: string, status: QuotationStatus | undefined, skip: number, take: number) {
    const where: Prisma.QuotationWhereInput = { customerId };
    if (status) where.status = status;
    const [rows, totalItems] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { customerName: true, phone: true } } },
      }),
      prisma.quotation.count({ where }),
    ]);
    return { rows, totalItems };
  },
};
