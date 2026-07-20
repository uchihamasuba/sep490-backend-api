import { z } from 'zod';

export const itemIdParamSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
});

const itemStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']);

// Đã chốt ở docs/api/taobaogiamoi_api.md mục 3.3: khi KHÔNG truyền page/limit, trả toàn bộ item khớp
// filter (không phân trang) — phục vụ use-case "tải hết rồi nhóm theo danh mục" ở modal báo giá/đơn.
export const listCatalogItemsQuerySchema = z.object({
  status: itemStatusEnum.optional(),
  typeId: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const createCatalogItemBodySchema = z.object({
  itemCode: z.string().trim().min(1).optional(),
  itemName: z.string().trim().min(1, 'itemName is required'),
  typeId: z.string().trim().min(1, 'typeId is required'),
  description: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1, 'unit is required'),
  rentalPrice: z.coerce.number().nonnegative().default(0),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  priceValidFrom: z.coerce.date().optional(),
  priceValidTo: z.coerce.date().optional(),
  imageUrl: z.string().trim().min(1).optional(),
  status: itemStatusEnum.default('ACTIVE'),
});

// PUT /catalog/items/:id — itemCode không sửa được sau khi tạo (docs/api/admin_danhmucthietbi_api.md
// mục 3.2), không nằm trong body sửa.
export const updateCatalogItemBodySchema = z.object({
  itemName: z.string().trim().min(1, 'itemName is required'),
  typeId: z.string().trim().min(1, 'typeId is required'),
  description: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1, 'unit is required'),
  rentalPrice: z.coerce.number().nonnegative(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  priceValidFrom: z.coerce.date().optional(),
  priceValidTo: z.coerce.date().optional(),
  imageUrl: z.string().trim().min(1).optional(),
});

export const updateCatalogItemStatusBodySchema = z.object({
  status: itemStatusEnum,
});

export const categoryIdParamSchema = z.object({
  categoryId: z.string().trim().min(1, 'categoryId is required'),
});

export const listCategoriesQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const createCategoryBodySchema = z.object({
  categoryName: z.string().trim().min(1, 'categoryName is required'),
  description: z.string().trim().min(1).optional(),
});

export const updateCategoryBodySchema = createCategoryBodySchema;

export const listTypesQuerySchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export type ItemIdParam = z.infer<typeof itemIdParamSchema>;
export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;
export type ListCatalogItemsQuery = z.infer<typeof listCatalogItemsQuerySchema>;
export type CreateCatalogItemBody = z.infer<typeof createCatalogItemBodySchema>;
export type UpdateCatalogItemBody = z.infer<typeof updateCatalogItemBodySchema>;
export type UpdateCatalogItemStatusBody = z.infer<typeof updateCatalogItemStatusBodySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
export type ListTypesQuery = z.infer<typeof listTypesQuerySchema>;
