import { Router } from 'express';
import { reportController } from './report.controller';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { getRevenueReportQuerySchema } from './report.validators';

const router = Router();

// Only ADMIN or MANAGER should access revenue reports
router.get(
  '/revenue',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  validate(getRevenueReportQuerySchema, 'query'),
  reportController.getRevenueReport
);

export { router as reportRouter };
