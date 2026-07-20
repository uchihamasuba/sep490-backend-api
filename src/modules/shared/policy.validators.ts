import { z } from 'zod';

const policyTypeEnum = z.enum(['DEPOSIT', 'CANCELLATION', 'COMPENSATION', 'FEE']);

export const listPoliciesQuerySchema = z.object({
  policyType: policyTypeEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export type ListPoliciesQuery = z.infer<typeof listPoliciesQuerySchema>;
