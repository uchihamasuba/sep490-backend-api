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
  inventoryDetailQuerySchema,
  itemIdParamSchema,
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  listReportsQuerySchema,
  listReservationsQuerySchema,
  orderIdParamSchema,
  repairInventoryBodySchema,
  reportIdParamSchema,
  reservationsTimelineQuerySchema,
  scrapInventoryBodySchema,
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
  requireRole('MANAGER', 'ADMIN'),
  validate(createInventoryBodySchema, 'body'),
  asyncHandler(inventoryController.create),
);

// Ghi tồn kho — CHỈ Manager, Admin luôn nhận 403 (đã chốt ở docs/api/thietbikhohang_api.md đầu file:
// "bản Admin phải read-only ở tầng backend cho mọi endpoint ghi", áp dụng nhất quán cho cả cụm Kho vận).
// CẬP NHẬT: Hiện đã cấp quyền ADMIN cho các thao tác /adjust, /
router.post(
  '/adjust',
  requireRole('MANAGER', 'ADMIN'),
  validate(adjustInventoryBodySchema, 'body'),
  asyncHandler(inventoryController.adjust),
);

// Bảo trì hàng hỏng — Sửa chữa (damaged−) / Thanh lý (damaged−, total−). Chỉ Manager/Admin.
router.post(
  '/repair',
  requireRole('MANAGER', 'ADMIN'),
  validate(repairInventoryBodySchema, 'body'),
  asyncHandler(inventoryController.repair),
);
router.post(
  '/scrap',
  requireRole('MANAGER', 'ADMIN'),
  validate(scrapInventoryBodySchema, 'body'),
  asyncHandler(inventoryController.scrap),
);

router.get('/movements', validate(listMovementsQuerySchema, 'query'), asyncHandler(inventoryController.listMovements));

// Đối soát tồn (Phase 6): dựng lại on_hand từ inventory_movements, phát hiện bất biến bị vi phạm. Manager/Admin.
router.get('/reconcile', requireRole('MANAGER', 'ADMIN'), asyncHandler(inventoryController.reconcile));

// Timeline thiết bị (Phase 7 #3): reservation của mọi item trong [from,to], gom theo item + cờ over-committed.
router.get(
  '/reservations-timeline',
  validate(reservationsTimelineQuerySchema, 'query'),
  asyncHandler(inventoryController.reservationsTimeline),
);

router.get(
  '/picklist/:orderId',
  validate(orderIdParamSchema, 'params'),
  asyncHandler(inventoryController.getPicklist),
);

// Thu hồi & hoàn kho: Leader (mobile) nộp biên bản, Manager xác nhận trên web — cùng mô hình đã dùng
// cho survey-reports (operations module). Nới thêm STAFF (docs/api/api.md gap (j)) để đọc lại báo
// cáo đã nộp.
router.get(
  '/collected-equipment-reports',
  requireRole('MANAGER', 'ADMIN', 'STAFF'),
  validate(listReportsQuerySchema, 'query'),
  asyncHandler(inventoryController.listReports),
);

router.post(
  '/collected-equipment-reports',
  requireRole('STAFF'),
  validate(createReportBodySchema, 'body'),
  asyncHandler(inventoryController.createReport),
);

router.get(
  '/collected-equipment-reports/:reportId',
  requireRole('MANAGER', 'ADMIN'),
  validate(reportIdParamSchema, 'params'),
  asyncHandler(inventoryController.getReportById),
);

// Nới thêm STAFF (docs/api/api.md gap (k), đã chốt 2026-07-22) — Leader tự xác nhận "đã trả kho" trên
// app, giới hạn ở tầng service theo order của plan họ được phân công (inventoryService.confirmReport).
router.put(
  '/collected-equipment-reports/:reportId/confirm',
  requireRole('MANAGER', 'STAFF'),
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
  requireRole('STAFF'),
  validate(createReportBodySchema, 'body'),
  asyncHandler(inventoryController.createReport),
);

router.get(
  '/return-reports/:reportId',
  requireRole('MANAGER', 'ADMIN'),
  validate(reportIdParamSchema, 'params'),
  asyncHandler(inventoryController.getReportById),
);

// Nới thêm STAFF — cùng lý do đã ghi ở alias chính `/collected-equipment-reports/:reportId/confirm`.
router.put(
  '/return-reports/:reportId/confirm',
  requireRole('MANAGER', 'STAFF'),
  validate(reportIdParamSchema, 'params'),
  validate(confirmReportBodySchema, 'body'),
  asyncHandler(inventoryController.confirmReport),
);

// Lịch bận thiết bị: liệt kê reservation của 1 item trong khoảng [from,to]. Đăng ký TRƯỚC catch-all /:itemId.
router.get(
  '/:itemId/reservations',
  validate(itemIdParamSchema, 'params'),
  validate(listReservationsQuerySchema, 'query'),
  asyncHandler(inventoryController.listItemReservations),
);

// Route tham số 1 đoạn (`/:itemId`) đăng ký SAU CÙNG trong nhóm GET để không "nuốt" các path tĩnh ở trên
// (Express khớp theo thứ tự đăng ký, không theo độ cụ thể).
router.get(
  '/:itemId',
  validate(itemIdParamSchema, 'params'),
  validate(inventoryDetailQuerySchema, 'query'),
  asyncHandler(inventoryController.getByItemId),
);

export default router;
