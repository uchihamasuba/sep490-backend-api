import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { inventoryController } from './inventory.controller';
import {
  adjustInventoryBodySchema,
  confirmReportBodySchema,
  createInventoryBodySchema,
  createReportBodySchema,
  itemIdParamSchema,
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  listReportsQuerySchema,
  orderIdParamSchema,
  releaseInventoryBodySchema,
  reportIdParamSchema,
  reserveInventoryBodySchema,
} from './inventory.validators';

const router = Router();

router.use(requireAuth);

// Đọc tồn kho/lịch sử biến động: mọi role đã đăng nhập đều xem được (Leader/Technical hiện trường
// cũng cần tra cứu tồn kho khi chuẩn bị đồ) — chỉ các thao tác GHI mới giới hạn theo role bên dưới.
router.get('/', validate(listInventoryQuerySchema, 'query'), asyncHandler(inventoryController.list));

// Khởi tạo dòng tồn kho cho 1 item chưa có (item mới tạo ở catalog chưa có Inventory — xem ghi chú ở
// inventory.service.ts#createInventory) — cùng mức quyền với các thao tác ghi khác trong module này.
router.post(
  '/',
  requireRole('MANAGER'),
  validate(createInventoryBodySchema, 'body'),
  asyncHandler(inventoryController.create),
);

// Ghi tồn kho — CHỈ Manager, Admin luôn nhận 403 (đã chốt ở docs/api/thietbikhohang_api.md đầu file:
// "bản Admin phải read-only ở tầng backend cho mọi endpoint ghi", áp dụng nhất quán cho cả cụm Kho vận).
router.post(
  '/adjust',
  requireRole('MANAGER'),
  validate(adjustInventoryBodySchema, 'body'),
  asyncHandler(inventoryController.adjust),
);

router.post(
  '/reserve',
  requireRole('MANAGER'),
  validate(reserveInventoryBodySchema, 'body'),
  asyncHandler(inventoryController.reserve),
);

router.post(
  '/release',
  requireRole('MANAGER'),
  validate(releaseInventoryBodySchema, 'body'),
  asyncHandler(inventoryController.release),
);

router.get('/movements', validate(listMovementsQuerySchema, 'query'), asyncHandler(inventoryController.listMovements));

router.get(
  '/picklist/:orderId',
  validate(orderIdParamSchema, 'params'),
  asyncHandler(inventoryController.getPicklist),
);

// Thu hồi & hoàn kho: Leader (mobile) nộp biên bản, Manager xác nhận trên web — cùng mô hình đã dùng
// cho survey-reports (operations module). Nới thêm LEADER (docs/api/api.md gap (j)) để đọc lại báo
// cáo đã nộp.
router.get(
  '/collected-equipment-reports',
  requireRole('MANAGER', 'ADMIN', 'LEADER'),
  validate(listReportsQuerySchema, 'query'),
  asyncHandler(inventoryController.listReports),
);

router.post(
  '/collected-equipment-reports',
  requireRole('LEADER'),
  validate(createReportBodySchema, 'body'),
  asyncHandler(inventoryController.createReport),
);

router.get(
  '/collected-equipment-reports/:reportId',
  requireRole('MANAGER', 'ADMIN'),
  validate(reportIdParamSchema, 'params'),
  asyncHandler(inventoryController.getReportById),
);

// Nới thêm LEADER (docs/api/api.md gap (k), đã chốt 2026-07-22) — Leader tự xác nhận "đã trả kho" trên
// app, giới hạn ở tầng service theo order của plan họ được phân công (inventoryService.confirmReport).
router.put(
  '/collected-equipment-reports/:reportId/confirm',
  requireRole('MANAGER', 'LEADER'),
  validate(reportIdParamSchema, 'params'),
  validate(confirmReportBodySchema, 'body'),
  asyncHandler(inventoryController.confirmReport),
);

// Alias `/return-reports` — cùng route/permission/controller với `/collected-equipment-reports` ở
// trên (tên gọi phía FE theo docs/api/thuhoi_hoankho_api.md, cùng 1 bảng
// collected_equipment_reports đứng sau, không tách logic riêng).
router.get(
  '/return-reports',
  requireRole('MANAGER', 'ADMIN'),
  validate(listReportsQuerySchema, 'query'),
  asyncHandler(inventoryController.listReports),
);

router.post(
  '/return-reports',
  requireRole('LEADER'),
  validate(createReportBodySchema, 'body'),
  asyncHandler(inventoryController.createReport),
);

router.get(
  '/return-reports/:reportId',
  requireRole('MANAGER', 'ADMIN'),
  validate(reportIdParamSchema, 'params'),
  asyncHandler(inventoryController.getReportById),
);

// Nới thêm LEADER — cùng lý do đã ghi ở alias chính `/collected-equipment-reports/:reportId/confirm`.
router.put(
  '/return-reports/:reportId/confirm',
  requireRole('MANAGER', 'LEADER'),
  validate(reportIdParamSchema, 'params'),
  validate(confirmReportBodySchema, 'body'),
  asyncHandler(inventoryController.confirmReport),
);

// Route tham số 1 đoạn (`/:itemId`) đăng ký SAU CÙNG trong nhóm GET để không "nuốt" các path tĩnh ở trên
// (Express khớp theo thứ tự đăng ký, không theo độ cụ thể).
router.get('/:itemId', validate(itemIdParamSchema, 'params'), asyncHandler(inventoryController.getByItemId));

export default router;
