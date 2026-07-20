import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { catalogController } from './catalog.controller';
import { listTypesQuerySchema } from './catalog.validators';

// Mounted at /api/v1/catalog/types — đọc mọi role đã đăng nhập (dropdown chọn loại thiết bị khi tạo
// item/danh mục), không có route ghi trong phạm vi đợt này.
const router = Router();

router.use(requireAuth);

router.get('/', validate(listTypesQuerySchema, 'query'), asyncHandler(catalogController.listTypes));

export default router;
