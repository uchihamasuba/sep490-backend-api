import type { ActiveStatus, Prisma, Supplier, SupplierTransactionStatus, PaymentStatus } from '@prisma/client';
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

  async findItemsBySupplierId(supplierId: string, skip?: number, take?: number, search?: string) {
    const whereClause: Prisma.SupplierItemWhereInput = { supplierId };
    if (search) {
      whereClause.OR = [
        { item: { itemName: { contains: search } } },
        { supplierItemCode: { contains: search } },
      ];
    }
    const [rows, totalItems] = await Promise.all([
      prisma.supplierItem.findMany({
        where: whereClause,
        include: { item: true },
        orderBy: { item: { itemName: 'asc' } },
        skip,
        take,
      }),
      prisma.supplierItem.count({ where: whereClause }),
    ]);
    return { rows, totalItems };
  },

  findSuppliersByItemId(itemId: string) {
    return prisma.supplierItem.findMany({
      where: { itemId },
      include: { supplier: true },
      orderBy: { supplier: { supplierName: 'asc' } },
    });
  },

  delete(supplierId: string) {
    return prisma.supplier.update({ where: { supplierId }, data: { status: 'INACTIVE' } });
  },

  assignItem(supplierId: string, data: Prisma.SupplierItemUncheckedCreateInput) {
    return prisma.supplierItem.upsert({
      where: {
        supplierId_itemId: { supplierId, itemId: data.itemId },
      },
      update: data,
      create: data,
    });
  },

  updateItem(supplierId: string, itemId: string, data: Prisma.SupplierItemUpdateInput) {
    return prisma.supplierItem.update({
      where: { supplierId_itemId: { supplierId, itemId } },
      data,
    });
  },

  removeItem(supplierId: string, itemId: string) {
    return prisma.supplierItem.update({
      where: { supplierId_itemId: { supplierId, itemId } },
      data: { isActive: false },
    });
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

  async generateNextSupplierCode(): Promise<string> {
    const count = await prisma.supplier.count();
    const nextNumber = count + 1;
    return `SUP-${nextNumber.toString().padStart(3, '0')}`;
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

  async generateNextTransactionCode(): Promise<string> {
    const lastTx = await prisma.supplierTransaction.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { transactionCode: true }
    });
    
    if (!lastTx || !lastTx.transactionCode.startsWith('STX-')) {
      return 'STX-001';
    }
    
    const match = lastTx.transactionCode.match(/STX-(\d+)/);
    const lastNumber = match ? parseInt(match[1], 10) : 0;
    const nextNumber = lastNumber + 1;
    
    return `STX-${nextNumber.toString().padStart(3, '0')}`;
  },

  async createTransaction(
    data: Prisma.SupplierTransactionUncheckedCreateInput,
    items: Omit<Prisma.SupplierTransactionItemUncheckedCreateInput, 'transactionId'>[]
  ) {
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.supplierTransaction.create({ data });
      const itemsToCreate = items.map((item) => ({ ...item, transactionId: transaction.transactionId }));
      await tx.supplierTransactionItem.createMany({ data: itemsToCreate });
      return tx.supplierTransaction.findUnique({
        where: { transactionId: transaction.transactionId },
        include: transactionDetailInclude,
      });
    });
  },

  async updateTransaction(
    transactionId: string,
    data: Prisma.SupplierTransactionUncheckedUpdateInput,
    items?: Omit<Prisma.SupplierTransactionItemUncheckedCreateInput, 'transactionId'>[]
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.supplierTransaction.update({ where: { transactionId }, data });
      if (items && items.length > 0) {
        await tx.supplierTransactionItem.deleteMany({ where: { transactionId } });
        const itemsToCreate = items.map((item) => ({ ...item, transactionId }));
        await tx.supplierTransactionItem.createMany({ data: itemsToCreate });
      }
      return tx.supplierTransaction.findUnique({
        where: { transactionId },
        include: transactionDetailInclude,
      });
    });
  },

  async deleteTransaction(transactionId: string) {
    // cascade delete items as per schema
    return prisma.supplierTransaction.delete({ where: { transactionId } });
  },

  async updateTransactionStatus(transactionId: string, status: SupplierTransactionStatus) {
    return prisma.supplierTransaction.update({
      where: { transactionId },
      data: { status },
      include: transactionDetailInclude,
    });
  },

  async updateTransactionPaymentStatus(transactionId: string, paymentStatus: PaymentStatus) {
    return prisma.supplierTransaction.update({
      where: { transactionId },
      data: { paymentStatus },
      include: transactionDetailInclude,
    });
  },

};
