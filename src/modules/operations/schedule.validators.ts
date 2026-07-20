import { z } from 'zod';

export const planIdParamSchema = z.object({
  planId: z.string().trim().min(1, 'planId is required'),
});

export const assigneeParamSchema = z.object({
  planId: z.string().trim().min(1, 'planId is required'),
  userId: z.string().trim().min(1, 'userId is required'),
});

const scheduleStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const planMemberRoleEnum = z.enum(['LEAD', 'TECHNICAL']);

export const listSchedulePlansQuerySchema = z
  .object({
    orderId: z.string().trim().min(1).optional(),
    status: scheduleStatusEnum.optional(),
    taskId: z.string().trim().min(1).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .refine((data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo, {
    message: 'dateFrom must be before or equal to dateTo',
    path: ['dateTo'],
  });

const assigneeInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
  role: planMemberRoleEnum,
});

export const createSchedulePlanBodySchema = z
  .object({
    orderId: z.string().trim().min(1, 'orderId is required'),
    taskId: z.string().trim().min(1, 'taskId is required'),
    startTime: z.coerce.date(),
    endTime: z.coerce.date().optional(),
    location: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional(),
    assignees: z.array(assigneeInputSchema).default([]),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export const updateSchedulePlanBodySchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date().optional(),
    location: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional(),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export const updateSchedulePlanStatusBodySchema = z.object({
  status: scheduleStatusEnum,
  notes: z.string().trim().min(1).optional(),
  evidenceId: z.string().trim().min(1).optional(),
});

export const addAssigneeBodySchema = assigneeInputSchema;

// POST /schedule-plans/batch — tạo nhiều dòng cùng orderId trong 1 transaction (docs/api/
// kehoachvaphancong_api.md mục 8.5 điểm 2), tránh trạng thái lưu dở dang nếu gọi POST tuần tự bị lỗi
// giữa chừng.
const batchPlanInputSchema = z
  .object({
    taskId: z.string().trim().min(1, 'taskId is required'),
    startTime: z.coerce.date(),
    endTime: z.coerce.date().optional(),
    location: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional(),
    assignees: z.array(assigneeInputSchema).default([]),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export const createSchedulePlansBatchBodySchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required'),
  plans: z.array(batchPlanInputSchema).min(1, 'plans must contain at least 1 line'),
});

export type PlanIdParam = z.infer<typeof planIdParamSchema>;
export type AssigneeParam = z.infer<typeof assigneeParamSchema>;
export type ListSchedulePlansQuery = z.infer<typeof listSchedulePlansQuerySchema>;
export type CreateSchedulePlanBody = z.infer<typeof createSchedulePlanBodySchema>;
export type UpdateSchedulePlanBody = z.infer<typeof updateSchedulePlanBodySchema>;
export type UpdateSchedulePlanStatusBody = z.infer<typeof updateSchedulePlanStatusBodySchema>;
export type AddAssigneeBody = z.infer<typeof addAssigneeBodySchema>;
export type CreateSchedulePlansBatchBody = z.infer<typeof createSchedulePlansBatchBodySchema>;
export type BatchPlanInput = z.infer<typeof batchPlanInputSchema>;
