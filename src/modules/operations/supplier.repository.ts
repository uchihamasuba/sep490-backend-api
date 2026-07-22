import type { ActiveStatus, Prisma, Supplier, SupplierTransactionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface SupplierListFilter {
  status?: ActiveStatus;
  search?: string;
}

export interface SupplierListParams extends SupplierListFilter {
  skip: number;
  take: number;
}

function buildSupplierWhere(filter: SupplierListFilter): Prisma.SupplierWhereInput {
  const where: Prisma.SupplierWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    const q = filter.search;
    where.OR = [
      { supplierCode: { contains: q } },
      { supplierName: { contains: q } },
      { phone: { contains: q } },
    ];
  }
  return where;
}

export const supplierRepository = {
  async findMany(params: SupplierListParams) {
    const where = buildSupplierWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.supplier.findMany({ where, skip: params.skip, take: params.take, orderBy: { createdAt: 'desc' } }),
      prisma.supplier.count({ where }),
    ]);
    return { rows, totalItems };
  },

  findById(supplierId: string): Promise<Supplier | null> {
    return prisma.supplier.findUnique({ where: { supplierId } });
  },

  findByCode(supplierCode: string): Promise<Supplier | null> {
    return prisma.supplier.findUnique({ where: { supplierCode } });
  },

  create(data: Prisma.SupplierCreateInput): Promise<Supplier> {
    return prisma.supplier.create({ data });
  },

  update(supplierId: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return prisma.supplier.update({ where: { supplierId }, data });
  },

  // debtBalance tính động, không lưu cột riêng — hướng khuyến nghị ở docs/api/supplier_api.md mục 3.1.
  async sumOutstandingBySupplierIds(supplierIds: string[]) {
    if (supplierIds.length === 0) return [];
    return prisma.supplierTransaction.groupBy({
      by: ['supplierId'],
      where: { supplierId: { in: supplierIds }, status: { not: 'CANCELLED' }, paymentStatus: { not: 'PAID' } },
      _sum: { estimatedCost: true, depositAmount: true },
    });
  },

  async sumOutstandingForSupplier(supplierId: string) {
    const result = await prisma.supplierTransaction.aggregate({
      where: { supplierId, status: { not: 'CANCELLED' }, paymentStatus: { not: 'PAID' } },
      _sum: { estimatedCost: true, depositAmount: true },
    });
    return result._sum;
  },
};

export interface SupplierTransactionListFilter {
  supplierId?: string;
  orderId?: string;
  status?: SupplierTransactionStatus;
}

export interface SupplierTransactionListParams extends SupplierTransactionListFilter {
  skip: number;
  take: number;
}

const transactionInclude = {
  supplier: { select: { supplierId: true, supplierName: true } },
  order: { select: { orderId: true, orderCode: true } },
} satisfies Prisma.SupplierTransactionInclude;

export type SupplierTransactionWithDetails = Prisma.SupplierTransactionGetPayload<{ include: typeof transactionInclude }>;

function buildTransactionWhere(filter: SupplierTransactionListFilter): Prisma.SupplierTransactionWhereInput {
  const where: Prisma.SupplierTransactionWhereInput = {};
  if (filter.supplierId) where.supplierId = filter.supplierId;
  if (filter.orderId) where.orderId = filter.orderId;
  if (filter.status) where.status = filter.status;
  return where;
}

const transactionDetailInclude = {
  ...transactionInclude,
  items: true,
} satisfies Prisma.SupplierTransactionInclude;

export type SupplierTransactionWithItems = Prisma.SupplierTransactionGetPayload<{ include: typeof transactionDetailInclude }>;

export const supplierTransactionRepository = {
  async findMany(params: SupplierTransactionListParams) {
    const where = buildTransactionWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.supplierTransaction.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: transactionInclude,
      }),
      prisma.supplierTransaction.count({ where }),
    ]);
    return { rows, totalItems };
  },

  // GET /supplier-transactions/:id — chi tiết kèm items[] (docs/api/api.md gap (q), api-contracts.md
  // mục 9), FE cần để hiển thị SupplierTransactionSection ở app Staff.
  findById(transactionId: string): Promise<SupplierTransactionWithItems | null> {
    return prisma.supplierTransaction.findUnique({ where: { transactionId }, include: transactionDetailInclude });
  },

  findItemById(stItemId: string) {
    return prisma.supplierTransactionItem.findUnique({ where: { stItemId } });
  },

  updateItemReceivedQuantity(stItemId: string, receivedQuantity: number) {
    return prisma.supplierTransactionItem.update({ where: { stItemId }, data: { receivedQuantity } });
  },

  // Giới hạn LEADER chỉ thao tác trên transaction thuộc order của plan họ được phân công (docs/api/
  // api.md gap (h)/(i)) — kiểm tra tồn tại 1 dòng schedule_plan_assignees của user trên bất kỳ plan nào
  // thuộc order đó.
  async isUserAssignedToOrder(userId: string, orderId: string): Promise<boolean> {
    const assignee = await prisma.schedulePlanAssignee.findFirst({
      where: { userId, plan: { orderId } },
      select: { assigneeId: true },
    });
    return assignee !== null;
  },
};
