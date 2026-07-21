import { z } from 'zod';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Đúng 10 chữ số, bắt buộc số đầu là 0 — đã chốt ở docs/api/taokhachhang_api.md mục 4, quyết định 3.
const PHONE_RE = /^0\d{9}$/;

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
  phone: z
    .string()
    .trim()
    .min(1, 'phone is required')
    .regex(PHONE_RE, 'Số điện thoại phải đủ 10 số và bắt đầu bằng số 0.'),
  email: emailField,
  // Bắt buộc ở modal "Thêm khách hàng" (docs/api/taokhachhang_api.md mục 1) — khác PUT (vẫn nullable).
  address: z.string().trim().min(1, 'address is required'),
  notes: z.string().trim().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateCustomerBodySchema = z.object({
  customerName: z.string().trim().min(1, 'customerName is required'),
  phone: z
    .string()
    .trim()
    .min(1, 'phone is required')
    .regex(PHONE_RE, 'Số điện thoại phải đủ 10 số và bắt đầu bằng số 0.'),
  email: emailField,
  address: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
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
