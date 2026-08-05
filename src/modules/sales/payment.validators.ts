import { z } from 'zod';

export const depositIdParamSchema = z.object({
  depositId: z.string().trim().min(1, 'Thiếu mã khoản cọc'),
});

export const settlementIdParamSchema = z.object({
  settlementId: z.string().trim().min(1, 'Thiếu mã bản quyết toán'),
});

// UNPAID không xuất hiện ở đây — đây là trạng thái khởi tạo, không phải đích chuyển tới qua endpoint
// này (docs/api/tiendosukien_api.md mục 3.1: PUT /deposits/:id { status: "PAID" }).
const depositTargetStatusEnum = z.enum(['PAID', 'CANCELLED']);

export const updateDepositStatusBodySchema = z.object({
  status: depositTargetStatusEnum,
  evidenceId: z.string().trim().min(1).optional(),
  evidenceIds: z.array(z.string().trim().min(1)).optional(),
}).transform((data) => {
  if (!data.evidenceIds && data.evidenceId) {
    data.evidenceIds = [data.evidenceId];
  }
  return data;
});

export const confirmSettlementBodySchema = z.object({
  status: z.literal('PAID'),
  evidenceId: z.string().trim().min(1).optional(),
  evidenceIds: z.array(z.string().trim().min(1)).optional(),
}).transform((data) => {
  if (!data.evidenceIds && data.evidenceId) {
    data.evidenceIds = [data.evidenceId];
  }
  return data;
});

// PUT /settlements/:settlementId/mark-paid — transition UNPAID -> PAID (docs/api/api.md gap (n)),
// Leader bấm "Xác nhận đã thu tiền" tại hiện trường kèm 1 ảnh bằng chứng.
export const markSettlementPaidBodySchema = z.object({
  evidenceId: z.string().trim().min(1).optional(),
  evidenceIds: z.array(z.string().trim().min(1)).optional(),
}).transform((data) => {
  if (!data.evidenceIds && data.evidenceId) {
    data.evidenceIds = [data.evidenceId];
  }
  return data;
}).refine((data) => data.evidenceIds && data.evidenceIds.length > 0, {
  message: 'Thiếu mã bằng chứng',
  path: ['evidenceIds'],
});

// GET /deposits (gộp toàn hệ thống) — gap chính đã ghi ở docs/api/datcoc_api.md mục 1.2/8.
const depositStatusEnum = z.enum(['UNPAID', 'PAID', 'CANCELLED']);

export const listDepositsQuerySchema = z.object({
  status: depositStatusEnum.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type DepositIdParam = z.infer<typeof depositIdParamSchema>;
export type SettlementIdParam = z.infer<typeof settlementIdParamSchema>;
export type UpdateDepositStatusBody = z.infer<typeof updateDepositStatusBodySchema>;
export type ConfirmSettlementBody = z.infer<typeof confirmSettlementBodySchema>;
export type MarkSettlementPaidBody = z.infer<typeof markSettlementPaidBodySchema>;
export type ListDepositsQuery = z.infer<typeof listDepositsQuerySchema>;
