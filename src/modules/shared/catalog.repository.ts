import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface CatalogItemListFilter {
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  typeId?: string;
  categoryId?: string;
  search?: string;
  isCombo?: boolean;
}

export interface CatalogItemListParams extends CatalogItemListFilter {
  skip?: number;
  take?: number;
}

const detailInclude = {
  type: { include: { category: true } },
  inventory: true,
  components: {
    include: {
      child: {
        include: { inventory: true },
      },
    },
  },
  _count: { select: { components: true } },
} satisfies Prisma.ItemInclude;

export type CatalogItemWithType = Prisma.ItemGetPayload<{ include: typeof detailInclude }>;

function buildWhere(filter: CatalogItemListFilter): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.typeId) where.typeId = filter.typeId;
  if (filter.categoryId) where.type = { categoryId: filter.categoryId };
  if (filter.search) where.itemName = { contains: filter.search };
  if (filter.isCombo !== undefined) {
    if (filter.isCombo) {
      where.components = { some: {} };
    } else {
      where.components = { none: {} };
    }
  }
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
    components?: { componentItemId: string; quantity: number }[];
  }): Promise<CatalogItemWithType> {
    const { components, ...rest } = data;
    return prisma.item.create({
      data: {
        ...rest,
        components: components
          ? {
              create: components.map((c) => ({
                childId: c.componentItemId,
                quantity: c.quantity,
              })),
            }
          : undefined,
      },
      include: detailInclude,
    });
  },

  findById(itemId: string): Promise<CatalogItemWithType | null> {
    return prisma.item.findUnique({ where: { itemId }, include: detailInclude });
  },

  async update(
    itemId: string,
    data: {
      itemName: string;
      typeId: string;
      description: string | null;
      unit: string;
      rentalPrice: number;
      purchasePrice: number | null;
      priceValidFrom: Date | null;
      priceValidTo: Date | null;
      imageUrl: string | null;
      components?: { componentItemId: string; quantity: number }[];
    },
  ): Promise<CatalogItemWithType> {
    const { components, ...rest } = data;

    if (components) {
      await prisma.$transaction([
        prisma.itemComponent.deleteMany({ where: { parentId: itemId } }),
        prisma.item.update({
          where: { itemId },
          data: {
            ...rest,
            components: {
              create: components.map((c) => ({
                childId: c.componentItemId,
                quantity: c.quantity,
              })),
            },
          },
        }),
      ]);
      return prisma.item.findUniqueOrThrow({ where: { itemId }, include: detailInclude });
    }

    return prisma.item.update({ where: { itemId }, data: rest, include: detailInclude });
  },

  updateStatus(itemId: string, status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'): Promise<CatalogItemWithType> {
    return prisma.item.update({ where: { itemId }, data: { status }, include: detailInclude });
  },

  findComponentsByItemId(itemId: string) {
    return prisma.itemComponent.findMany({
      where: { parentId: itemId },
      include: { child: { include: { inventory: true } } },
    });
  },
};

export interface CategoryListFilter {
  search?: string;
}

export interface CategoryListParams extends CategoryListFilter {
  skip?: number;
  take?: number;
}

function buildCategoryWhere(filter: CategoryListFilter): Prisma.ItemCategoryWhereInput {
  const where: Prisma.ItemCategoryWhereInput = {};
  if (filter.search) where.categoryName = { contains: filter.search };
  return where;
}

export const catalogCategoryRepository = {
  async findMany(params: CategoryListParams) {
    const where = buildCategoryWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.itemCategory.findMany({ where, skip: params.skip, take: params.take, orderBy: { categoryName: 'asc' } }),
      prisma.itemCategory.count({ where }),
    ]);
    return { rows, totalItems };
  },

  findById(categoryId: string) {
    return prisma.itemCategory.findUnique({ where: { categoryId } });
  },

  create(data: { categoryName: string; description: string | null }) {
    return prisma.itemCategory.create({ data });
  },

  update(categoryId: string, data: { categoryName: string; description: string | null }) {
    return prisma.itemCategory.update({ where: { categoryId }, data });
  },
};

export interface TypeListFilter {
  categoryId?: string;
  search?: string;
}

export interface TypeListParams extends TypeListFilter {
  skip?: number;
  take?: number;
}

const typeWithCategoryInclude = { category: true } satisfies Prisma.ItemTypeInclude;
export type ItemTypeWithCategory = Prisma.ItemTypeGetPayload<{ include: typeof typeWithCategoryInclude }>;

function buildTypeWhere(filter: TypeListFilter): Prisma.ItemTypeWhereInput {
  const where: Prisma.ItemTypeWhereInput = {};
  if (filter.categoryId) where.categoryId = filter.categoryId;
  if (filter.search) where.typeName = { contains: filter.search };
  return where;
}

export const catalogTypeRepository = {
  async findMany(params: TypeListParams) {
    const where = buildTypeWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.itemType.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { typeName: 'asc' },
        include: typeWithCategoryInclude,
      }),
      prisma.itemType.count({ where }),
    ]);
    return { rows, totalItems };
  },
  findById(typeId: string) {
    return prisma.itemType.findUnique({ where: { typeId }, include: typeWithCategoryInclude });
  },
  create(data: { categoryId: string; typeName: string; description: string | null }) {
    return prisma.itemType.create({ data, include: typeWithCategoryInclude });
  },
  update(typeId: string, data: { categoryId: string; typeName: string; description: string | null }) {
    return prisma.itemType.update({ where: { typeId }, data, include: typeWithCategoryInclude });
  },
  updateStatus(typeId: string, isActive: boolean) {
    return prisma.itemType.update({ where: { typeId }, data: { isActive }, include: typeWithCategoryInclude });
  },
};
