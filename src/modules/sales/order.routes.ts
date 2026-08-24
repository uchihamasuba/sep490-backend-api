import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { orderController } from './order.controller';
import {
  closeOrderBodySchema,
  confirmPreparedItemsBodySchema,
  createChangeRequestBodySchema,
  createDepositBodySchema,
  createOrderBodySchema,
  createSettlementBodySchema,
  exportEquipmentBodySchema,
  listOrdersQuerySchema,
  listPicklistsQuerySchema,
  orderIdParamSchema,
  orderItemIdParamSchema,
  updateLiveChecklistBodySchema,
  updateOrderItemBodySchema,
  updateOrderDatesBodySchema,
  updateOrderInfoBodySchema,
  updateOrderItemsBodySchema,
  updateOrderQuotationBodySchema,
  updateOrderStatusBodySchema,
} from './order.validators';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(listOrdersQuerySchema, 'query'),
  asyncHandler(orderController.list),
);

router.post(
  '/',
  requireRole('MANAGER'),
  validate(createOrderBodySchema, 'body'),
  asyncHandler(orderController.create),
);

// Đăng ký TRƯỚC `/:orderId` — Express khớp theo thứ tự đăng ký, không theo độ cụ thể (cùng lưu ý ở
// inventory.routes.ts), nếu không "stats"/"picklists" sẽ bị nuốt làm giá trị orderId.
router.get('/stats', requireRole('MANAGER', 'ADMIN'), asyncHandler(orderController.stats));

// Pick-list xuất kho (docs/api/picklistxuatkho_api.md) — trang không có mirror Admin, chỉ Manager.
router.get(
  '/picklists',
  requireRole('MANAGER'),
  validate(listPicklistsQuerySchema, 'query'),
  asyncHandler(orderController.listPicklists),
);

router.get(
  '/:orderId',
  requireRole('MANAGER', 'ADMIN', 'STAFF'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.getById),
);

router.patch(
  '/:orderId',
  requireRole('MANAGER'),
  validate(updateOrderInfoBodySchema, 'body'),
  asyncHandler(orderController.updateInfo),
);

router.delete(
  '/:orderId',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.remove),
);

router.put(
  '/:orderId/status',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(updateOrderStatusBodySchema, 'body'),
  asyncHandler(orderController.updateStatus),
);

router.put(
  '/:orderId/items',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(updateOrderItemsBodySchema, 'body'),
  asyncHandler(orderController.updateItems),
);

// Đổi ngày sự kiện (reschedule) — Manager. Đơn đã chốt sẽ tự dời cửa sổ giữ chỗ + 409 nếu ngày mới thiếu hàng.
router.put(
  '/:orderId/dates',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(updateOrderDatesBodySchema, 'body'),
  asyncHandler(orderController.updateDates),
);

router.put(
  '/:orderId/items/confirm-prepared',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(confirmPreparedItemsBodySchema, 'body'),
  asyncHandler(orderController.confirmPreparedItems),
);

router.patch(
  '/:orderId/items/:orderItemId',
  requireRole('MANAGER'),
  validate(orderItemIdParamSchema, 'params'),
  validate(updateOrderItemBodySchema, 'body'),
  asyncHandler(orderController.updateItem),
);

router.get(
  '/:orderId/survey',
  requireRole('MANAGER', 'ADMIN'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.survey),
);

// Nới thêm STAFF (docs/api/api.md gap (f)) để Leader mobile ghi/xem cọc tại hiện trường khảo sát.
router.get(
  '/:orderId/deposits',
  requireRole('MANAGER', 'ADMIN', 'STAFF'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.deposits),
);

router.post(
  '/:orderId/deposits',
  requireRole('MANAGER', 'STAFF'),
  validate(orderIdParamSchema, 'params'),
  validate(createDepositBodySchema, 'body'),
  asyncHandler(orderController.createDeposit),
);

// Nới thêm STAFF (docs/api/api.md gap (m)) để Leader mobile tạo/xem yêu cầu quyết toán tại hiện
// trường khi thu hồi thiết bị xong.
router.get(
  '/:orderId/settlement',
  requireRole('MANAGER', 'ADMIN', 'STAFF'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.settlement),
);

router.post(
  '/:orderId/settlement',
  requireRole('MANAGER', 'STAFF'),
  validate(orderIdParamSchema, 'params'),
  validate(createSettlementBodySchema, 'body'),
  asyncHandler(orderController.createSettlement),
);

// Leader báo thay đổi thiết bị tại hiện trường (thêm/bớt/đổi) khi đơn đã CONFIRMED — Manager duyệt qua
// PUT /change-requests/:changeRequestId/approve (changeRequest.routes.ts, mounted top-level). Backend
// refactor 2026-07-26 gộp LEADER/TECHNICAL thành STAFF — giới hạn đúng Leader (vai trò LEAD của kế
// hoạch) ở tầng service (orderService.createChangeRequest), giống pattern createSettlement.
router.post(
  '/:orderId/change-requests',
  requireRole('MANAGER', 'STAFF'),
  validate(orderIdParamSchema, 'params'),
  validate(createChangeRequestBodySchema, 'body'),
  asyncHandler(orderController.createChangeRequest),
);

router.patch(
  '/:orderId/live-checklist',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(updateLiveChecklistBodySchema, 'body'),
  asyncHandler(orderController.updateLiveChecklist),
);

router.patch(
  '/:orderId/quotation',
  requireRole('MANAGER', 'ADMIN', 'STAFF'),
  validate(orderIdParamSchema, 'params'),
  validate(updateOrderQuotationBodySchema, 'body'),
  asyncHandler(orderController.updateQuotation),
);

router.put(
  '/:orderId/picklist/picked-up',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.markPicklistPickedUp),
);

// Xuất thiết bị (luồng nhanh từ màn chi tiết báo giá — docs/api/xuatthietbi_tubaogia_api.md mục 8):
// CHỈ đồng bộ order_items theo quotation_items, không đụng tồn kho thật — khác picklist/picked-up ở
// chỗ này cho phép chạy lặp lại vô hạn, không yêu cầu preparedQty đủ, không yêu cầu order_status.
router.post(
  '/:orderId/export-equipment',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(exportEquipmentBodySchema, 'body'),
  asyncHandler(orderController.exportEquipment),
);

router.put(
  '/:orderId/close',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(closeOrderBodySchema, 'body'),
  asyncHandler(orderController.close),
);

export default router;
