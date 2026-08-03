import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { catalogController } from './catalog.controller';
import {
  listTypesQuerySchema,
  createTypeBodySchema,
  typeIdParamSchema,
  updateTypeBodySchema,
  updateTypeStatusBodySchema,
} from './catalog.validators';

// Mounted at /api/v1/catalog/types — đọc mọi role đã đăng nhập (dropdown chọn loại thiết bị khi tạo
// item/danh mục), không có route ghi trong phạm vi đợt này.
const router = Router();

router.use(requireAuth);

router.get('/', validate(listTypesQuerySchema, 'query'), asyncHandler(catalogController.listTypes));
router.post('/', requireRole('ADMIN'), validate(createTypeBodySchema), asyncHandler(catalogController.createType));
router.put(
  '/:typeId',
  requireRole('ADMIN'),
  validate(typeIdParamSchema, 'params'),
  validate(updateTypeBodySchema),
  asyncHandler(catalogController.updateType),
);
router.patch(
  '/:typeId/status',
  requireRole('ADMIN'),
  validate(typeIdParamSchema, 'params'),
  validate(updateTypeStatusBodySchema),
  asyncHandler(catalogController.updateTypeStatus),
);

export default router;
