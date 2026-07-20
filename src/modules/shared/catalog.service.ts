import { AppError } from '../../utils/AppError';
import { catalogRepository, type CatalogItemWithType } from './catalog.repository';
import type { CreateCatalogItemBody, ListCatalogItemsQuery } from './catalog.validators';

export interface CatalogItemDTO {
  itemId: string;
  itemCode: string;
  itemName: string;
  typeId: string;
  typeName: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
  unit: string;
  rentalPrice: number;
  purchasePrice: number | null;
  priceValidFrom: string | null;
  priceValidTo: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogItemListMeta {
  page: number | null;
  limit: number | null;
  totalItems: number;
  totalPages: number | null;
}

function toNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapItem(row: CatalogItemWithType): CatalogItemDTO {
  return {
    itemId: row.itemId,
    itemCode: row.itemCode,
    itemName: row.itemName,
    typeId: row.typeId,
    typeName: row.type.typeName,
    categoryId: row.type.categoryId,
    categoryName: row.type.category.categoryName,
    description: row.description,
    unit: row.unit,
    rentalPrice: Number(row.rentalPrice),
    purchasePrice: toNumber(row.purchasePrice),
    priceValidFrom: row.priceValidFrom ? row.priceValidFrom.toISOString() : null,
    priceValidTo: row.priceValidTo ? row.priceValidTo.toISOString() : null,
    imageUrl: row.imageUrl,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Đã chốt ở docs/api/taobaogiamoi_api.md mục 3.3: chỉ phân trang khi client CHỦ ĐỘNG truyền page/limit,
// mặc định trả toàn bộ item khớp filter (catalog thiết bị sự kiện thực tế chỉ vài trăm dòng).
async function listItems(
  query: ListCatalogItemsQuery,
): Promise<{ data: CatalogItemDTO[]; meta: CatalogItemListMeta }> {
  const paginated = query.page !== undefined || query.limit !== undefined;
  const page = query.page ?? 1;
  const limit = query.limit ?? 1000;
  const skip = paginated ? (page - 1) * limit : undefined;
  const take = paginated ? limit : undefined;

  const { rows, totalItems } = await catalogRepository.findMany({
    status: query.status,
    typeId: query.typeId,
    categoryId: query.categoryId,
    search: query.search,
    skip,
    take,
  });

  return {
    data: rows.map(mapItem),
    meta: paginated
      ? { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
      : { page: null, limit: null, totalItems, totalPages: null },
  };
}

async function createItem(body: CreateCatalogItemBody): Promise<CatalogItemDTO> {
  const type = await catalogRepository.typeExists(body.typeId);
  if (!type) throw AppError.notFound('Item type not found');

  const itemCode = body.itemCode ?? (await catalogRepository.generateNextItemCode());
  const created = await catalogRepository.create({
    itemCode,
    itemName: body.itemName,
    typeId: body.typeId,
    description: body.description ?? null,
    unit: body.unit,
    rentalPrice: body.rentalPrice,
    purchasePrice: body.purchasePrice ?? null,
    priceValidFrom: body.priceValidFrom ?? null,
    priceValidTo: body.priceValidTo ?? null,
    imageUrl: body.imageUrl ?? null,
    status: body.status,
  });

  return mapItem(created);
}

export const catalogService = {
  listItems,
  createItem,
};
