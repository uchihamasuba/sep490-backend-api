import { z } from 'zod';

export const userIdParamSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
});

const userRoleEnum = z.enum(['ADMIN', 'MANAGER', 'LEADER', 'TECHNICAL']);
const userStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const listUsersQuerySchema = z.object({
  role: userRoleEnum.optional(),
  status: userStatusEnum.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
