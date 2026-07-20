import { z } from 'zod';

// Path param tên "id" (không phải "evidenceId") khớp đúng shape endpoint đã đặc tả:
// GET /api/v1/evidence/:id.
export const evidenceIdParamSchema = z.object({
  id: z.string().trim().min(1, 'id is required'),
});

export type EvidenceIdParam = z.infer<typeof evidenceIdParamSchema>;
