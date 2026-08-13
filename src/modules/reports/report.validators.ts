import { z } from 'zod';

export const getRevenueReportQuerySchema = z.object({
  startDate: z.string().trim().min(1, 'startDate is required').refine(val => !isNaN(Date.parse(val)), 'Invalid startDate format'),
  endDate: z.string().trim().min(1, 'endDate is required').refine(val => !isNaN(Date.parse(val)), 'Invalid endDate format'),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'startDate must be less than or equal to endDate',
  path: ['startDate'],
});

export type GetRevenueReportQuery = z.infer<typeof getRevenueReportQuerySchema>;
