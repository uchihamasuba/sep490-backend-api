import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { catalogController } from './catalog.controller';
import {
  createCatalogItemBodySchema,
  itemIdParamSchema,
  listCatalogItemsQuerySchema,
  updateCatalogItemBodySchema,
  updateCatalogItemStatusBodySchema,
} from './catalog.validators';

// Mounted at /api/v1/catalog/items
const router = Router();

router.use(requireAuth);

// Đọc catalog: mọi role đã đăng nhập (dùng chung bởi modal báo giá/đơn — docs/api/taobaogiamoi_api.md).
router.get('/', validate(listCatalogItemsQuerySchema, 'query'), asyncHandler(catalogController.list));

// Tạo item catalog: Manager + Admin. CLAUDE.md xếp "thiết bị (catalog)" vào master data thuộc quyền
// Admin, và toàn bộ UI tạo/sửa thiết bị nằm ở admin/ (admin/catalog/create, admin/catalog/[id]/edit).
// Trước đây chỉ cho MANAGER khiến admin bấm Lưu bị 403 mà manager lại không có UI → không role nào tạo
// được thiết bị qua web (chốt mở quyền ADMIN 2026-08-11 sau test E2E).
router.post(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(createCatalogItemBodySchema, 'body'),
  asyncHandler(catalogController.create),
);

router.get(
  '/:itemId',
  validate(itemIdParamSchema, 'params'),
  asyncHandler(catalogController.getById),
);

router.get(
  '/:itemId/components',
  requireRole('MANAGER', 'ADMIN'),
  validate(itemIdParamSchema, 'params'),
  asyncHandler(catalogController.getItemComponents),
);

router.get(
  '/:itemId/suppliers',
  requireRole('MANAGER', 'ADMIN'), // Based on supplier API requirements
  validate(itemIdParamSchema, 'params'),
  asyncHandler(catalogController.getSuppliers),
);

router.put(
  '/:itemId',
  requireRole('MANAGER', 'ADMIN'),
  validate(itemIdParamSchema, 'params'),
  validate(updateCatalogItemBodySchema, 'body'),
  asyncHandler(catalogController.update),
);

router.patch(
  '/:itemId/status',
  requireRole('MANAGER', 'ADMIN'),
  validate(itemIdParamSchema, 'params'),
  validate(updateCatalogItemStatusBodySchema, 'body'),
  asyncHandler(catalogController.updateStatus),
);

export default router;
