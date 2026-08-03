import type { ItemCategory } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import {
  catalogCategoryRepository,
  catalogRepository,
  catalogTypeRepository,
  type CatalogItemWithType,
  type ItemTypeWithCategory,
} from './catalog.repository';
import { supplierRepository } from '../operations/supplier.repository';
import { inventoryService } from '../inventory/inventory.service';
import type {
  CreateCatalogItemBody,
  CreateCategoryBody,
  ListCatalogItemsQuery,
  ListCategoriesQuery,
  ListTypesQuery,
  UpdateCatalogItemBody,
  UpdateCategoryBody,
  CreateTypeBody,
  UpdateTypeBody,
} from './catalog.validators';

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
  quantityTotal: number;
  quantityAvailable: number;
  isCombo: boolean;
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
    quantityTotal: row.inventory?.quantityTotal ?? 0,
    quantityAvailable: (row.inventory?.quantityTotal ?? 0) - (row.inventory?.quantityDamaged ?? 0),
    isCombo: (row._count?.components ?? 0) > 0,
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
    isCombo: query.isCombo,
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
  if (!type) throw AppError.notFound('Không tìm thấy loại thiết bị');

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
    components: body.components,
  });

  const isCombo = body.components && body.components.length > 0;
  if (!isCombo) {
    await inventoryService.createInventory({
      itemId: created.itemId,
      quantityTotal: 0,
      quantityDamaged: 0,
    });
  }

  return mapItem(created);
}

async function getItemById(itemId: string): Promise<CatalogItemDTO> {
  const item = await catalogRepository.findById(itemId);
  if (!item) throw AppError.notFound('Không tìm thấy thiết bị');
  return mapItem(item);
}

async function updateItem(itemId: string, body: UpdateCatalogItemBody): Promise<CatalogItemDTO> {
  const existing = await catalogRepository.findById(itemId);
  if (!existing) throw AppError.notFound('Không tìm thấy thiết bị');

  const type = await catalogRepository.typeExists(body.typeId);
  if (!type) throw AppError.notFound('Không tìm thấy loại thiết bị');

  const updated = await catalogRepository.update(itemId, {
    itemName: body.itemName,
    typeId: body.typeId,
    description: body.description ?? null,
    unit: body.unit,
    rentalPrice: body.rentalPrice,
    purchasePrice: body.purchasePrice ?? null,
    priceValidFrom: body.priceValidFrom ?? null,
    priceValidTo: body.priceValidTo ?? null,
    imageUrl: body.imageUrl ?? null,
    components: body.components,
  });

  return mapItem(updated);
}

async function updateItemStatus(itemId: string, status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'): Promise<CatalogItemDTO> {
  const existing = await catalogRepository.findById(itemId);
  if (!existing) throw AppError.notFound('Không tìm thấy thiết bị');

  const updated = await catalogRepository.updateStatus(itemId, status);
  return mapItem(updated);
}

export interface ItemComponentDTO {
  componentId: string;
  childItemId: string;
  childItemName: string;
  unit: string;
  quantity: number;
}

async function getItemComponents(itemId: string): Promise<ItemComponentDTO[]> {
  const existing = await catalogRepository.findById(itemId);
  if (!existing) throw AppError.notFound('Không tìm thấy thiết bị');

  const components = await catalogRepository.findComponentsByItemId(itemId);
  return components.map((c) => ({
    componentId: c.id,
    childItemId: c.childId,
    childItemName: c.child.itemName,
    unit: c.child.unit,
    quantity: c.quantity,
  }));
}

export interface ItemSupplierDetailsDTO {
  itemId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  rentalPrice: number;
  purchasePrice: number;
  isActive: boolean;
  minQuantity: number | null;
  supplierItemCode: string | null;
  createdAt: string;
  updatedAt: string;
}

async function getItemSuppliers(itemId: string): Promise<ItemSupplierDetailsDTO[]> {
  const existing = await catalogRepository.findById(itemId);
  if (!existing) throw AppError.notFound('Không tìm thấy thiết bị');

  const supplierItems = await supplierRepository.findSuppliersByItemId(itemId);

  return supplierItems.map((si) => ({
    itemId: si.itemId,
    supplierId: si.supplierId,
    supplierCode: si.supplier.supplierCode,
    supplierName: si.supplier.supplierName,
    serviceType: si.supplier.serviceType,
    phone: si.supplier.phone,
    email: si.supplier.email,
    address: si.supplier.address,
    rentalPrice: toNumber(si.rentalPrice) || 0,
    purchasePrice: toNumber(si.purchasePrice) || 0,
    isActive: si.isActive,
    minQuantity: si.minQuantity,
    supplierItemCode: si.supplierItemCode,
    createdAt: si.createdAt.toISOString(),
    updatedAt: si.updatedAt.toISOString(),
  }));
}

export interface CategoryDTO {
  categoryId: string;
  categoryName: string;
  description: string | null;
}

export interface CategoryListMeta {
  page: number | null;
  limit: number | null;
  totalItems: number;
  totalPages: number | null;
}

function mapCategory(row: ItemCategory): CategoryDTO {
  return { categoryId: row.categoryId, categoryName: row.categoryName, description: row.description };
}

// Cùng quy ước "chỉ phân trang khi client chủ động truyền page/limit" đã dùng cho items (mục 3.3
// taobaogiamoi_api.md) — áp dụng nhất quán cho categories/types trong cùng module catalog.
async function listCategories(query: ListCategoriesQuery): Promise<{ data: CategoryDTO[]; meta: CategoryListMeta }> {
  const paginated = query.page !== undefined || query.limit !== undefined;
  const page = query.page ?? 1;
  const limit = query.limit ?? 1000;
  const skip = paginated ? (page - 1) * limit : undefined;
  const take = paginated ? limit : undefined;

  const { rows, totalItems } = await catalogCategoryRepository.findMany({ search: query.search, skip, take });

  return {
    data: rows.map(mapCategory),
    meta: paginated
      ? { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
      : { page: null, limit: null, totalItems, totalPages: null },
  };
}

async function createCategory(body: CreateCategoryBody): Promise<CategoryDTO> {
  const created = await catalogCategoryRepository.create({
    categoryName: body.categoryName,
    description: body.description ?? null,
  });
  return mapCategory(created);
}

async function updateCategory(categoryId: string, body: UpdateCategoryBody): Promise<CategoryDTO> {
  const existing = await catalogCategoryRepository.findById(categoryId);
  if (!existing) throw AppError.notFound('Không tìm thấy danh mục');

  const updated = await catalogCategoryRepository.update(categoryId, {
    categoryName: body.categoryName,
    description: body.description ?? null,
  });
  return mapCategory(updated);
}

export interface TypeDTO {
  typeId: string;
  categoryId: string;
  categoryName: string;
  typeName: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

export interface TypeListMeta {
  page: number | null;
  limit: number | null;
  totalItems: number;
  totalPages: number | null;
}

function mapType(row: ItemTypeWithCategory): TypeDTO {
  return {
    typeId: row.typeId,
    categoryId: row.categoryId,
    categoryName: row.category.categoryName,
    typeName: row.typeName,
    description: row.description,
    imageUrl: row.imageUrl,
    isActive: row.isActive,
  };
}

async function listTypes(query: ListTypesQuery): Promise<{ data: TypeDTO[]; meta: TypeListMeta }> {
  const paginated = query.page !== undefined || query.limit !== undefined;
  const page = query.page ?? 1;
  const limit = query.limit ?? 1000;
  const skip = paginated ? (page - 1) * limit : undefined;
  const take = paginated ? limit : undefined;

  const { rows, totalItems } = await catalogTypeRepository.findMany({
    categoryId: query.categoryId,
    search: query.search,
    skip,
    take,
  });

  return {
    data: rows.map(mapType),
    meta: paginated
      ? { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
      : { page: null, limit: null, totalItems, totalPages: null },
  };
}

async function createType(body: CreateTypeBody): Promise<TypeDTO> {
  const category = await catalogCategoryRepository.findById(body.categoryId);
  if (!category) throw AppError.notFound('Không tìm thấy danh mục');
  const created = await catalogTypeRepository.create({
    categoryId: body.categoryId,
    typeName: body.typeName,
    description: body.description ?? null,
  });
  return mapType(created);
}

async function updateType(typeId: string, body: UpdateTypeBody): Promise<TypeDTO> {
  const existing = await catalogTypeRepository.findById(typeId);
  if (!existing) throw AppError.notFound('Không tìm thấy nhóm thiết bị');
  const category = await catalogCategoryRepository.findById(body.categoryId);
  if (!category) throw AppError.notFound('Không tìm thấy danh mục');
  const updated = await catalogTypeRepository.update(typeId, {
    categoryId: body.categoryId,
    typeName: body.typeName,
    description: body.description ?? null,
  });
  return mapType(updated);
}

async function updateTypeStatus(typeId: string, isActive: boolean): Promise<TypeDTO> {
  const existing = await catalogTypeRepository.findById(typeId);
  if (!existing) throw AppError.notFound('Không tìm thấy nhóm thiết bị');
  const updated = await catalogTypeRepository.updateStatus(typeId, isActive);
  return mapType(updated);
}

export const catalogService = {
  listItems,
  createItem,
  getItemById,
  getItemComponents,
  updateItem,
  updateItemStatus,
  getItemSuppliers,
  listCategories,
  createCategory,
  updateCategory,
  listTypes,
  createType,
  updateType,
  updateTypeStatus,
};
