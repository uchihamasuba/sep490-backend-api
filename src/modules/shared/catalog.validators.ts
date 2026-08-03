import { z } from 'zod';

export const itemIdParamSchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
});

const itemStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']);

// Đã chốt ở docs/api/taobaogiamoi_api.md mục 3.3: khi KHÔNG truyền page/limit, trả toàn bộ item khớp
// filter (không phân trang) — phục vụ use-case "tải hết rồi nhóm theo danh mục" ở modal báo giá/đơn.
export const listCatalogItemsQuerySchema = z.object({
  status: itemStatusEnum.optional(),
  typeId: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

// Cả 2 mốc cùng được truyền thì "hiệu lực từ" phải trước "hiệu lực đến" — tránh lưu 1 khoảng ngày rỗng
// khiến priceValidFrom/priceValidTo vô nghĩa khi hiển thị/lọc theo giá đang áp dụng.
const priceDateRangeRefinement = <T extends { priceValidFrom?: Date; priceValidTo?: Date }>(data: T) =>
  !data.priceValidFrom || !data.priceValidTo || data.priceValidFrom <= data.priceValidTo;
const priceDateRangeRefinementOptions = {
  message: 'Ngày hiệu lực từ phải trước hoặc bằng ngày hiệu lực đến',
  path: ['priceValidTo'],
};

export const createCatalogItemBodySchema = z
  .object({
    itemCode: z.string().trim().optional(),
    itemName: z.string().trim().min(1, 'Vui lòng nhập tên thiết bị'),
    typeId: z.string().trim().min(1, 'Thiếu mã loại thiết bị'),
    description: z.string().trim().optional(),
    unit: z.string().trim().min(1, 'Vui lòng nhập đơn vị tính'),
    rentalPrice: z.coerce.number().nonnegative().default(0),
    purchasePrice: z.coerce.number().nonnegative().optional(),
    priceValidFrom: z.coerce.date().optional(),
    priceValidTo: z.coerce.date().optional(),
    imageUrl: z.string().trim().optional(),
    status: itemStatusEnum.default('ACTIVE'),
  })
  .refine(priceDateRangeRefinement, priceDateRangeRefinementOptions);

// PUT /catalog/items/:id — itemCode không sửa được sau khi tạo (docs/api/admin_danhmucthietbi_api.md
// mục 3.2), không nằm trong body sửa.
export const updateCatalogItemBodySchema = z
  .object({
    itemName: z.string().trim().min(1, 'Vui lòng nhập tên thiết bị'),
    typeId: z.string().trim().min(1, 'Thiếu mã loại thiết bị'),
    description: z.string().trim().optional(),
    unit: z.string().trim().min(1, 'Vui lòng nhập đơn vị tính'),
    rentalPrice: z.coerce.number().nonnegative(),
    purchasePrice: z.coerce.number().nonnegative().optional(),
    priceValidFrom: z.coerce.date().optional(),
    priceValidTo: z.coerce.date().optional(),
    imageUrl: z.string().trim().optional(),
  })
  .refine(priceDateRangeRefinement, priceDateRangeRefinementOptions);

export const updateCatalogItemStatusBodySchema = z.object({
  status: itemStatusEnum,
});

export const categoryIdParamSchema = z.object({
  categoryId: z.string().trim().min(1, 'Thiếu mã danh mục'),
});

export const listCategoriesQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const createCategoryBodySchema = z.object({
  categoryName: z.string().trim().min(1, 'Vui lòng nhập tên danh mục'),
  description: z.string().trim().optional(),
});

export const updateCategoryBodySchema = createCategoryBodySchema;

export const listTypesQuerySchema = z.object({
  categoryId: z.string().trim().optional(),
  search: z.string().trim().optional(),
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

export const typeIdParamSchema = z.object({
  typeId: z.string().trim().min(1, 'Thiếu mã nhóm thiết bị'),
});
export const createTypeBodySchema = z.object({
  categoryId: z.string().trim().min(1, 'Thiếu mã danh mục'),
  typeName: z.string().trim().min(1, 'Vui lòng nhập tên nhóm thiết bị'),
  description: z.string().trim().optional(),
});
export const updateTypeBodySchema = createTypeBodySchema;
export const updateTypeStatusBodySchema = z.object({
  isActive: z.boolean(),
});
export type TypeIdParam = z.infer<typeof typeIdParamSchema>;
export type CreateTypeBody = z.infer<typeof createTypeBodySchema>;
export type UpdateTypeBody = z.infer<typeof updateTypeBodySchema>;
export type UpdateTypeStatusBody = z.infer<typeof updateTypeStatusBodySchema>;
