import { z } from 'zod';

export const changeRequestIdParamSchema = z.object({
  changeRequestId: z.string().trim().min(1, 'changeRequestId is required'),
});

const changeRequestStatusEnum = z.enum(['pending', 'approved', 'rejected']);

export const listChangeRequestsQuerySchema = z.object({
  status: changeRequestStatusEnum.optional(),
  orderId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

// PENDING không xuất hiện — đây là trạng thái khởi tạo, không phải đích chuyển tới qua endpoint duyệt.
export const approveChangeRequestBodySchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export type ChangeRequestIdParam = z.infer<typeof changeRequestIdParamSchema>;
export type ListChangeRequestsQuery = z.infer<typeof listChangeRequestsQuerySchema>;
export type ApproveChangeRequestBody = z.infer<typeof approveChangeRequestBodySchema>;
