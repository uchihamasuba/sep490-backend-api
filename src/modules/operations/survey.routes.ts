import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { surveyController } from './survey.controller';
import {
  confirmSurveyReportBodySchema,
  createSurveyReportBodySchema,
  listSurveyReportsQuerySchema,
  surveyIdParamSchema,
} from './survey.validators';

const router = Router();

router.use(requireAuth);

// Đọc danh sách/chi tiết: đúng 2 trang web đã tài liệu hóa (Manager vận hành, Admin audit) —
// docs/api/khaosathientruong_api.md mục 0.
router.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listSurveyReportsQuerySchema, 'query'),
  asyncHandler(surveyController.list),
);

router.get(
  '/:surveyId',
  requireRole('MANAGER', 'ADMIN'),
  validate(surveyIdParamSchema, 'params'),
  asyncHandler(surveyController.getById),
);

// Tạo báo cáo: đã chốt là hành động của Leader Staff qua mobile, không còn nút trên web — endpoint vẫn
// giữ nguyên cho mobile gọi (docs/api/khaosathientruong_api.md mục 0/5).
router.post(
  '/',
  requireRole('LEADER'),
  validate(createSurveyReportBodySchema, 'body'),
  asyncHandler(surveyController.create),
);

// Xác nhận: hành động ghi duy nhất còn lại của Manager trên web (mục 4).
router.put(
  '/:surveyId/confirm',
  requireRole('MANAGER'),
  validate(surveyIdParamSchema, 'params'),
  validate(confirmSurveyReportBodySchema, 'body'),
  asyncHandler(surveyController.confirm),
);

export default router;
