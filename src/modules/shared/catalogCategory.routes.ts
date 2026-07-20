import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { catalogController } from './catalog.controller';
import { categoryIdParamSchema, createCategoryBodySchema, listCategoriesQuerySchema, updateCategoryBodySchema } from './catalog.validators';

// Mounted at /api/v1/catalog/categories (docs/api/admin_quanlydanhmucthietbi_api.md).
const router = Router();

router.use(requireAuth);

router.get('/', validate(listCategoriesQuerySchema, 'query'), asyncHandler(catalogController.listCategories));

router.post(
  '/',
  requireRole('ADMIN'),
  validate(createCategoryBodySchema, 'body'),
  asyncHandler(catalogController.createCategory),
);

router.put(
  '/:categoryId',
  requireRole('ADMIN'),
  validate(categoryIdParamSchema, 'params'),
  validate(updateCategoryBodySchema, 'body'),
  asyncHandler(catalogController.updateCategory),
);

export default router;
