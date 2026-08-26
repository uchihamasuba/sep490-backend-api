import { z } from 'zod';

export const itemIdParamSchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().trim().min(1, 'Thiếu mã đơn hàng'),
});

export const reportIdParamSchema = z.object({
  reportId: z.string().trim().min(1, 'Thiếu mã phiếu thu hồi thiết bị'),
});

const movementTypeEnum = z.enum(['OUTBOUND', 'INBOUND', 'ADJUSTMENT'], {
  message: 'movementType không hợp lệ, chỉ chấp nhận OUTBOUND, INBOUND hoặc ADJUSTMENT',
});
const reportTypeEnum = z.enum(['INTERNAL', 'SUPPLIER'], {
  message: 'reportType không hợp lệ, chỉ chấp nhận INTERNAL hoặc SUPPLIER',
});
const reportStatusEnum = z.enum(['SUBMITTED', 'CONFIRMED'], {
  message: 'status không hợp lệ, chỉ chấp nhận SUBMITTED hoặc CONFIRMED',
});

export const inventoryDetailQuerySchema = z.object({
  date: z.coerce.date().optional(),
});
export type InventoryDetailQuery = z.infer<typeof inventoryDetailQuerySchema>;

export const listInventoryQuerySchema = z.object({
  itemId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  date: z.coerce.date().optional(),
  // Loại trừ reservation của 1 đơn khi tính "đã giữ chỗ" — trang chi tiết đơn truyền orderId của chính nó
  // để xem khả dụng "cho đơn này" (không tự trừ phần đơn đã giữ). Không truyền = tính toàn hệ thống.
  excludeOrderId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export const listMovementsQuerySchema = z.object({
  itemId: z.string().trim().min(1).optional(),
  orderId: z.string().trim().min(1).optional(),
  movementType: movementTypeEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export const createInventoryBodySchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
  quantityTotal: z.coerce.number().int().nonnegative().default(0),
  quantityDamaged: z.coerce.number().int().nonnegative().default(0),
});

export const adjustInventoryBodySchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
  deltaTotal: z.coerce.number().int().refine((v) => v !== 0, 'Số lượng điều chỉnh không được bằng 0'),
  notes: z.string().trim().optional(),
});

// Bảo trì hàng hỏng: sửa chữa (damaged −= qty) / thanh lý (damaged −= qty, total −= qty).
export const repairInventoryBodySchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
  quantity: z.coerce.number().int().positive('Số lượng phải lớn hơn 0'),
  notes: z.string().trim().optional(),
});
export const scrapInventoryBodySchema = repairInventoryBodySchema;

// Lịch bận thiết bị: liệt kê reservation của 1 item trong khoảng [from, to].
export const listReservationsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// GET /inventory/reservations-timeline — reservation của mọi item trong [from,to], có thể lọc theo danh mục.
export const reservationsTimelineQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  categoryId: z.string().uuid().optional(),
});

export const listReportsQuerySchema = z.object({
  status: reportStatusEnum.optional(),
  orderId: z.string().trim().min(1).optional(),
  // Lọc theo loại báo cáo: INTERNAL (hoàn kho nội bộ) hoặc SUPPLIER (trả thiết bị thuê NCC). Cho phép
  // FE (trang suppliers/returns) chỉ kéo về báo cáo SUPPLIER thay vì lọc client-side toàn trang.
  reportType: reportTypeEnum.optional(),
  // Lọc theo đúng 1 giao dịch NCC (khi cần xem báo cáo trả cho 1 phiếu thuê cụ thể).
  transactionId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const reportItemInputSchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
  goodQuantity: z.coerce.number().int().nonnegative().default(0),
  damagedQuantity: z.coerce.number().int().nonnegative().default(0),
  lostQuantity: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().trim().optional(),
});

export const createReportBodySchema = z.object({
  orderId: z.string().trim().min(1, 'Thiếu mã đơn hàng'),
  reportType: reportTypeEnum,
  transactionId: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  items: z.array(reportItemInputSchema).min(1, 'Danh sách thiết bị phải có ít nhất 1 dòng'),
  // Ảnh minh chứng kiểm đếm thu hồi (hỏng/mất) — evidenceId từ POST /evidence/upload; nhiều ảnh.
  evidenceIds: z.array(z.string().trim().min(1)).optional(),
});

export const confirmReportBodySchema = z.object({
  notes: z.string().trim().optional(),
});

export type ItemIdParam = z.infer<typeof itemIdParamSchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type ReportIdParam = z.infer<typeof reportIdParamSchema>;
export type CreateInventoryBody = z.infer<typeof createInventoryBodySchema>;
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
export type AdjustInventoryBody = z.infer<typeof adjustInventoryBodySchema>;
export type RepairInventoryBody = z.infer<typeof repairInventoryBodySchema>;
export type ScrapInventoryBody = z.infer<typeof scrapInventoryBodySchema>;
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;
export type ReservationsTimelineQuery = z.infer<typeof reservationsTimelineQuerySchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type CreateReportBody = z.infer<typeof createReportBodySchema>;
export type ConfirmReportBody = z.infer<typeof confirmReportBodySchema>;
