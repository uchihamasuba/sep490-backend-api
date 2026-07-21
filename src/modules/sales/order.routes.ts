import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { orderController } from './order.controller';
import {
  closeOrderBodySchema,
  confirmPreparedItemsBodySchema,
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
  requireRole('MANAGER', 'ADMIN'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.getById),
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

router.get(
  '/:orderId/deposits',
  requireRole('MANAGER', 'ADMIN'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.deposits),
);

router.post(
  '/:orderId/deposits',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(createDepositBodySchema, 'body'),
  asyncHandler(orderController.createDeposit),
);

router.get(
  '/:orderId/settlement',
  requireRole('MANAGER', 'ADMIN'),
  validate(orderIdParamSchema, 'params'),
  asyncHandler(orderController.settlement),
);

router.post(
  '/:orderId/settlement',
  requireRole('MANAGER'),
  validate(orderIdParamSchema, 'params'),
  validate(createSettlementBodySchema, 'body'),
  asyncHandler(orderController.createSettlement),
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
  requireRole('MANAGER'),
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

// Xuất thiết bị (luồng nhanh từ màn chi tiết báo giá — docs/api/xuatthietbi_tubaogia_api.md):
// khác picklist/picked-up ở chỗ có hiệu ứng tồn kho thật + điều kiện nới (mục 4.2 tài liệu đó).
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
