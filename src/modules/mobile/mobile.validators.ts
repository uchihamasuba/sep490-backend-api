import { z } from 'zod';

export const mobileOrderIdParamSchema = z.object({
  id: z.string().trim().min(1, 'id is required'),
});

const reportTypeEnum = z.enum(['INTERNAL', 'SUPPLIER']);

const reportItemInputSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
  goodQuantity: z.coerce.number().int().nonnegative().default(0),
  damagedQuantity: z.coerce.number().int().nonnegative().default(0),
  lostQuantity: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().trim().min(1).optional(),
});

// POST /api/v1/mobile/orders/:id/collected-reports — orderId lấy từ path param, không nằm trong body
// (docs/api/thuhoi_hoankho_api.md mục 3: Leader Staff ghi nhận qua mobile ngay tại hiện trường).
export const createMobileReportBodySchema = z.object({
  reportType: reportTypeEnum.default('INTERNAL'),
  transactionId: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  items: z.array(reportItemInputSchema).min(1, 'items must contain at least 1 line'),
});

export type MobileOrderIdParam = z.infer<typeof mobileOrderIdParamSchema>;
export type CreateMobileReportBody = z.infer<typeof createMobileReportBodySchema>;
