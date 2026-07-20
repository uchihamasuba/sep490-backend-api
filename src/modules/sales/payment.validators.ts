import { z } from 'zod';

export const depositIdParamSchema = z.object({
  depositId: z.string().trim().min(1, 'depositId is required'),
});

export const settlementIdParamSchema = z.object({
  settlementId: z.string().trim().min(1, 'settlementId is required'),
});

// PENDING không xuất hiện ở đây — đây là trạng thái khởi tạo, không phải đích chuyển tới qua endpoint
// này (docs/api/tiendosukien_api.md mục 3.1: PUT /deposits/:id { status: "SUCCESS" }).
const depositTargetStatusEnum = z.enum(['SUCCESS', 'OVERDUE', 'CANCELLED']);

export const updateDepositStatusBodySchema = z.object({
  status: depositTargetStatusEnum,
});

export const confirmSettlementBodySchema = z.object({
  status: z.literal('CONFIRMED'),
});

export type DepositIdParam = z.infer<typeof depositIdParamSchema>;
export type SettlementIdParam = z.infer<typeof settlementIdParamSchema>;
export type UpdateDepositStatusBody = z.infer<typeof updateDepositStatusBodySchema>;
export type ConfirmSettlementBody = z.infer<typeof confirmSettlementBodySchema>;
