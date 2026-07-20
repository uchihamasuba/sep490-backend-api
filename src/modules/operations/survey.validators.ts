import { z } from 'zod';

export const surveyIdParamSchema = z.object({
  surveyId: z.string().trim().min(1, 'surveyId is required'),
});

const surveyStatusEnum = z.enum(['DRAFT', 'NEEDS_REVIEW', 'SUBMITTED', 'CONFIRMED']);

export const listSurveyReportsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: surveyStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const createSurveyReportBodySchema = z
  .object({
    orderId: z.string().trim().min(1, 'orderId is required'),
    planId: z.string().trim().min(1).optional(),
    surveyDate: z.coerce.date(),
    location: z.string().trim().min(1, 'location is required'),
    area: z.coerce.number().nonnegative().optional(),
    length: z.coerce.number().nonnegative().optional(),
    width: z.coerce.number().nonnegative().optional(),
    entrance: z.string().trim().min(1).optional(),
    siteConstraints: z.string().trim().min(1).optional(),
    additionalRequests: z.string().trim().min(1).optional(),
    proposedItems: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional(),
    evidenceId: z.string().trim().min(1).optional(),
  })
  // Kích thước mặt bằng (diện tích/dài/rộng) phải khai đủ bộ 3 hoặc bỏ hẳn — không chấp nhận khai nửa
  // vời (vd chỉ nhập area mà thiếu length/width) vì 3 số này mô tả cùng 1 phép đo mặt bằng.
  .refine(
    (data) => {
      const provided = [data.area, data.length, data.width].filter((v) => v !== undefined).length;
      return provided === 0 || provided === 3;
    },
    { message: 'area, length và width phải được khai đủ cả 3 hoặc để trống cả 3', path: ['area'] },
  );

export const confirmSurveyReportBodySchema = z.object({
  status: z.literal('CONFIRMED'),
});

export type SurveyIdParam = z.infer<typeof surveyIdParamSchema>;
export type ListSurveyReportsQuery = z.infer<typeof listSurveyReportsQuerySchema>;
export type CreateSurveyReportBody = z.infer<typeof createSurveyReportBodySchema>;
export type ConfirmSurveyReportBody = z.infer<typeof confirmSurveyReportBodySchema>;
