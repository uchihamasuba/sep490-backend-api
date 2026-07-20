import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { evidenceController } from './evidence.controller';
import { evidenceIdParamSchema } from './evidence.validators';

// Mounted at /api/v1/evidence — chỉ đọc (upload minh chứng nằm ở luồng nghiệp vụ tạo ra nó, vd
// survey-reports/schedule-plans, ngoài phạm vi module này).
const router = Router();

router.use(requireAuth);

router.get('/:id', validate(evidenceIdParamSchema, 'params'), asyncHandler(evidenceController.getById));

export default router;
