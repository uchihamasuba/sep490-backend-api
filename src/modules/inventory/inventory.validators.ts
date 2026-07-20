import { z } from 'zod';

export const itemIdParamSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
});

export const reportIdParamSchema = z.object({
  reportId: z.string().trim().min(1, 'reportId is required'),
});

const movementTypeEnum = z.enum(['OUTBOUND', 'INBOUND', 'ADJUSTMENT']);
const reportTypeEnum = z.enum(['INTERNAL', 'SUPPLIER']);
const reportStatusEnum = z.enum(['SUBMITTED', 'CONFIRMED']);

export const listInventoryQuerySchema = z.object({
  itemId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export const listMovementsQuerySchema = z.object({
  itemId: z.string().trim().min(1).optional(),
  orderId: z.string().trim().min(1).optional(),
  movementType: movementTypeEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export const createInventoryBodySchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
  quantityTotal: z.coerce.number().int().nonnegative().default(0),
  quantityDamaged: z.coerce.number().int().nonnegative().default(0),
});

export const adjustInventoryBodySchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
  deltaTotal: z.coerce.number().int().refine((v) => v !== 0, 'deltaTotal must not be 0'),
  notes: z.string().trim().min(1).optional(),
});

export const reserveInventoryBodySchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
  quantity: z.coerce.number().int().positive('quantity must be > 0'),
  orderId: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

export const releaseInventoryBodySchema = reserveInventoryBodySchema;

export const listReportsQuerySchema = z.object({
  status: reportStatusEnum.optional(),
  orderId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const reportItemInputSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
  goodQuantity: z.coerce.number().int().nonnegative().default(0),
  damagedQuantity: z.coerce.number().int().nonnegative().default(0),
  lostQuantity: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().trim().min(1).optional(),
});

export const createReportBodySchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
  reportType: reportTypeEnum,
  transactionId: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  items: z.array(reportItemInputSchema).min(1, 'items must contain at least 1 line'),
});

export const confirmReportBodySchema = z.object({
  notes: z.string().trim().min(1).optional(),
});

export type ItemIdParam = z.infer<typeof itemIdParamSchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type ReportIdParam = z.infer<typeof reportIdParamSchema>;
export type CreateInventoryBody = z.infer<typeof createInventoryBodySchema>;
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
export type AdjustInventoryBody = z.infer<typeof adjustInventoryBodySchema>;
export type ReserveInventoryBody = z.infer<typeof reserveInventoryBodySchema>;
export type ReleaseInventoryBody = z.infer<typeof releaseInventoryBodySchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type CreateReportBody = z.infer<typeof createReportBodySchema>;
export type ConfirmReportBody = z.infer<typeof confirmReportBodySchema>;
