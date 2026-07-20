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

// Tạo item catalog: Manager (đúng luồng "catalog phải đi trước báo giá", docs/api/taobaogiamoi_api.md
// mục 3.1 hướng A — chỉ Manager xây dựng catalog/báo giá theo CLAUDE.md).
router.post(
  '/',
  requireRole('MANAGER'),
  validate(createCatalogItemBodySchema, 'body'),
  asyncHandler(catalogController.create),
);

router.get(
  '/:itemId',
  validate(itemIdParamSchema, 'params'),
  asyncHandler(catalogController.getById),
);

router.put(
  '/:itemId',
  requireRole('MANAGER'),
  validate(itemIdParamSchema, 'params'),
  validate(updateCatalogItemBodySchema, 'body'),
  asyncHandler(catalogController.update),
);

router.patch(
  '/:itemId/status',
  requireRole('MANAGER'),
  validate(itemIdParamSchema, 'params'),
  validate(updateCatalogItemStatusBodySchema, 'body'),
  asyncHandler(catalogController.updateStatus),
);

export default router;
