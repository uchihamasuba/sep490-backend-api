import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface CatalogItemListFilter {
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  typeId?: string;
  categoryId?: string;
  search?: string;
}

export interface CatalogItemListParams extends CatalogItemListFilter {
  skip?: number;
  take?: number;
}

const detailInclude = {
  type: { include: { category: true } },
} satisfies Prisma.ItemInclude;

export type CatalogItemWithType = Prisma.ItemGetPayload<{ include: typeof detailInclude }>;

function buildWhere(filter: CatalogItemListFilter): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.typeId) where.typeId = filter.typeId;
  if (filter.categoryId) where.type = { categoryId: filter.categoryId };
  if (filter.search) where.itemName = { contains: filter.search };
  return where;
}

export const catalogRepository = {
  async findMany(params: CatalogItemListParams) {
    const where = buildWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.item.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { itemName: 'asc' },
        include: detailInclude,
      }),
      prisma.item.count({ where }),
    ]);
    return { rows, totalItems };
  },

  typeExists(typeId: string) {
    return prisma.itemType.findUnique({ where: { typeId } });
  },

  async generateNextItemCode(): Promise<string> {
    const count = await prisma.item.count();
    return `ITM-${String(count + 1).padStart(3, '0')}`;
  },

  create(data: {
    itemCode: string;
    itemName: string;
    typeId: string;
    description: string | null;
    unit: string;
    rentalPrice: number;
    purchasePrice: number | null;
    priceValidFrom: Date | null;
    priceValidTo: Date | null;
    imageUrl: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  }): Promise<CatalogItemWithType> {
    return prisma.item.create({ data, include: detailInclude });
  },
};
