import { z } from 'zod';

export const eventOrderIdParamSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
});

export type EventOrderIdParam = z.infer<typeof eventOrderIdParamSchema>;
