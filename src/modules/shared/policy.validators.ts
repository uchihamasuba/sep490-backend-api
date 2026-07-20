import { z } from 'zod';

const policyTypeEnum = z.enum(['DEPOSIT', 'CANCELLATION', 'COMPENSATION', 'FEE', 'WAGE']);

export const policyIdParamSchema = z.object({
  policyId: z.string().trim().min(1, 'policyId is required'),
});

export const listPoliciesQuerySchema = z.object({
  policyType: policyTypeEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

// docs/api/admin_taochinhsachmoi_api.md mục 2 — policyValue không giới hạn âm/0 ở FE, backend tự
// validate tối thiểu (không cho âm; = 0 vẫn hợp lệ, vd 1 policy có thể tạm để 0 chờ cập nhật sau).
export const createPolicyBodySchema = z.object({
  policyCode: z.string().trim().min(1, 'policyCode is required'),
  policyName: z.string().trim().min(1, 'policyName is required'),
  policyType: policyTypeEnum,
  policyValue: z.coerce.number().nonnegative('policyValue must be >= 0'),
  unit: z.string().trim().min(1, 'unit is required'),
  description: z.string().trim().min(1).optional(),
});

// policyCode/policyName/policyType KHÔNG sửa được sau khi tạo (docs/api/admin_chinhsuachinhsach_api.md
// mục 2) — dùng .strict() để 400 ngay nếu client vô tình gửi kèm các field đó, thay vì âm thầm bỏ qua.
export const updatePolicyBodySchema = z
  .object({
    policyValue: z.coerce.number().nonnegative('policyValue must be >= 0').optional(),
    unit: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export type PolicyIdParam = z.infer<typeof policyIdParamSchema>;
export type ListPoliciesQuery = z.infer<typeof listPoliciesQuerySchema>;
export type CreatePolicyBody = z.infer<typeof createPolicyBodySchema>;
export type UpdatePolicyBody = z.infer<typeof updatePolicyBodySchema>;
