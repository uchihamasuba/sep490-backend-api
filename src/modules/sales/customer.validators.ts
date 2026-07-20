import { z } from 'zod';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{8,20}$/;

const emailField = z
  .string()
  .trim()
  .refine((value) => value === '' || EMAIL_RE.test(value), { message: 'Invalid email' })
  .optional();

export const customerIdParamSchema = z.object({
  customerId: z.string().trim().min(1, 'customerId is required'),
});

export const listCustomersQuerySchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const createCustomerBodySchema = z.object({
  customerName: z.string().trim().min(1, 'customerName is required'),
  phone: z.string().trim().min(1, 'phone is required').regex(PHONE_RE, 'Invalid phone number'),
  email: emailField,
  address: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateCustomerBodySchema = z.object({
  customerName: z.string().trim().min(1, 'customerName is required'),
  phone: z.string().trim().min(1, 'phone is required').regex(PHONE_RE, 'Invalid phone number'),
  email: emailField,
  address: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  status: z.enum(['active', 'inactive']),
});

const orderStatusEnum = z.enum(['NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const listCustomerOrdersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: orderStatusEnum.optional(),
  serviceFilter: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(6),
});

export type CustomerIdParam = z.infer<typeof customerIdParamSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
export type CreateCustomerBody = z.infer<typeof createCustomerBodySchema>;
export type UpdateCustomerBody = z.infer<typeof updateCustomerBodySchema>;
export type ListCustomerOrdersQuery = z.infer<typeof listCustomerOrdersQuerySchema>;
