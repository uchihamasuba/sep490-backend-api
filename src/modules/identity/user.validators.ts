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

export const updateUserStatusBodySchema = z.object({
  status: userStatusEnum,
});

export const createUserBodySchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6),
  fullName: z.string().trim().min(1),
  role: userRoleEnum,
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().regex(/^0[0-9]{9}$/).optional().or(z.literal('')),
});

export const updateUserBodySchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  role: userRoleEnum.optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().regex(/^0[0-9]{9}$/).nullable().optional().or(z.literal('')),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBodySchema>;
export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
