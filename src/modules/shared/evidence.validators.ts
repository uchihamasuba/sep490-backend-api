import { z } from 'zod';

// Path param tên "id" (không phải "evidenceId") khớp đúng shape endpoint đã đặc tả:
// GET /api/v1/evidence/:id.
export const evidenceIdParamSchema = z.object({
  id: z.string().trim().min(1, 'id is required'),
});

// POST /evidence/upload — multipart/form-data, field "file" xử lý riêng bởi multer (không qua Zod).
// referenceType/referenceId được nhận nhưng KHÔNG có cột lưu ở Evidence — bị bỏ qua, khớp đúng hành vi
// đã xác nhận ở docs/api/datcoc_api.md mục 4.3, docs/api/lichtrinhkythuat_api.md mục 0.
export const uploadEvidenceBodySchema = z.object({
  description: z.string().trim().min(1).optional(),
  referenceType: z.string().trim().optional(),
  referenceId: z.string().trim().optional(),
});

export type EvidenceIdParam = z.infer<typeof evidenceIdParamSchema>;
export type UploadEvidenceBody = z.infer<typeof uploadEvidenceBodySchema>;
