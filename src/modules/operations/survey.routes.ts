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

// Tạo báo cáo: ban đầu chỉ Leader Staff qua mobile (docs/api/khaosathientruong_api.md mục 0/5), nhưng
// người dùng đã yêu cầu thêm lại nút "+ Tạo báo cáo khảo sát" cho Manager trên web (2026-07-21) — nới
// role cho cả MANAGER, giữ nguyên LEADER cho mobile.
router.post(
  '/',
  requireRole('LEADER', 'MANAGER'),
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
