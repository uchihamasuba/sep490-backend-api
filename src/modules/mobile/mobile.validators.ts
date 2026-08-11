import { z } from 'zod';

export const mobileOrderIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Thiếu mã đơn hàng'),
});

const reportTypeEnum = z.enum(['INTERNAL', 'SUPPLIER']);

const reportItemInputSchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
  goodQuantity: z.coerce.number().int().nonnegative().default(0),
  damagedQuantity: z.coerce.number().int().nonnegative().default(0),
  lostQuantity: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().trim().optional(),
});

// POST /api/v1/mobile/orders/:id/collected-reports — orderId lấy từ path param, không nằm trong body
// (docs/api/thuhoi_hoankho_api.md mục 3: Leader Staff ghi nhận qua mobile ngay tại hiện trường).
export const createMobileReportBodySchema = z.object({
  reportType: reportTypeEnum.default('INTERNAL'),
  transactionId: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  items: z.array(reportItemInputSchema).min(1, 'Danh sách thiết bị phải có ít nhất 1 dòng'),
  // Ảnh minh chứng kiểm đếm thu hồi (hỏng/mất) — evidenceId từ POST /evidence/upload; nhiều ảnh.
  evidenceIds: z.array(z.string().trim().min(1)).optional(),
});

export type MobileOrderIdParam = z.infer<typeof mobileOrderIdParamSchema>;
export type CreateMobileReportBody = z.infer<typeof createMobileReportBodySchema>;
