import { z } from 'zod';

export const planIdParamSchema = z.object({
  planId: z.string().trim().min(1, 'Thiếu mã kế hoạch'),
});

export const assigneeParamSchema = z.object({
  planId: z.string().trim().min(1, 'Thiếu mã kế hoạch'),
  userId: z.string().trim().min(1, 'Thiếu mã người dùng'),
});

const scheduleStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
  message: 'status không hợp lệ',
});
const planMemberRoleEnum = z.enum(['LEAD', 'TECHNICAL'], { message: 'role không hợp lệ, chỉ chấp nhận LEAD hoặc TECHNICAL' });

export const listSchedulePlansQuerySchema = z
  .object({
    orderId: z.string().trim().min(1).optional(),
    status: scheduleStatusEnum.optional(),
    taskId: z.string().trim().min(1).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    // 'timeline' (mặc định, giữ nguyên hành vi cũ) lọc theo [orders.event_date, MAX(end_time)] của cả
    // đơn — dùng cho view timeline theo đơn hàng. 'plan' lọc trực tiếp theo start_time của TỪNG dòng
    // schedule_plan — dùng cho lịch tuần/ngày cá nhân (mobile-manager) nơi cần đúng các plan thật sự
    // diễn ra trong khoảng ngày đang xem, không kèm việc của đơn khác chỉ vì event_date rơi vào cửa sổ.
    dateMode: z.enum(['timeline', 'plan']).optional(),
    // Lọc "chỉ plan của tôi" (docs/api/api.md gap (b)) — Leader/Technical gọi kèm assigneeUserId =
    // chính user.id đang đăng nhập thay vì tải toàn bộ hệ thống về lọc client-side.
    assigneeUserId: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .refine((data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo, {
    message: 'dateFrom phải nhỏ hơn hoặc bằng dateTo',
    path: ['dateTo'],
  });

const assigneeInputSchema = z.object({
  userId: z.string().trim().min(1, 'Thiếu mã người dùng'),
  role: planMemberRoleEnum,
});

export const createSchedulePlanBodySchema = z
  .object({
    orderId: z.string().trim().min(1, 'Thiếu mã đơn hàng'),
    taskId: z.string().trim().min(1, 'Thiếu mã đầu việc'),
    startTime: z.coerce.date(),
    endTime: z.coerce.date().optional(),
    location: z.string().trim().min(1).optional(),
    notes: z.string().trim().optional(),
    assignees: z.array(assigneeInputSchema).default([]),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
    path: ['endTime'],
  });

export const updateSchedulePlanBodySchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date().optional(),
    location: z.string().trim().min(1).optional(),
    notes: z.string().trim().optional(),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
    path: ['endTime'],
  });

// IN_PROGRESS/COMPLETED KHÔNG còn là input hợp lệ ở đây (docs/api/more-require.md mục (ae), đã chốt
// 2026-07-21) — 2 giá trị này giờ được service tự suy ra từ chấm công (attendances) của assignee LEAD
// khi gọi check-in/check-out, không còn là transition Leader/Technical tự PATCH tay qua endpoint này.
export const updateSchedulePlanStatusBodySchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED'], { message: 'status không hợp lệ, chỉ chấp nhận CONFIRMED hoặc CANCELLED' }),
  notes: z.string().trim().optional(),
  evidenceId: z.string().trim().min(1).optional(),
});

export const addAssigneeBodySchema = assigneeInputSchema;

// POST /schedule-plans/:planId/assignees/:userId/check-in — ảnh minh chứng chỉ chụp lúc bắt đầu (đã chốt
// ở docs/api/more-require.md mục (ag)), dùng đúng cột attendances.check_in_evidence_id có sẵn. Check-out
// KHÔNG nhận evidenceId (không thêm cột check_out_evidence_id).
export const checkInBodySchema = z.object({
  checkInEvidenceId: z.string().trim().min(1).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export const checkOutBodySchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

// PATCH /schedule-plans/:planId/evidence — gắn schedule_plans.evidence_id độc lập với transition status
// (đã chốt ở docs/api/more-require.md mục (ag), thay cho đường cũ PATCH .../status { COMPLETED,
// evidenceId } không còn dùng được). Không bắt buộc, nhân viên tự gắn khi có ảnh.
export const attachEvidenceBodySchema = z.object({
  evidenceId: z.string().trim().min(1, 'Thiếu mã ảnh minh chứng'),
});

// POST /schedule-plans/batch — tạo nhiều dòng cùng orderId trong 1 transaction (docs/api/
// kehoachvaphancong_api.md mục 8.5 điểm 2), tránh trạng thái lưu dở dang nếu gọi POST tuần tự bị lỗi
// giữa chừng.
const batchPlanInputSchema = z
  .object({
    taskId: z.string().trim().min(1, 'Thiếu mã đầu việc'),
    startTime: z.coerce.date(),
    endTime: z.coerce.date().optional(),
    location: z.string().trim().min(1).optional(),
    notes: z.string().trim().optional(),
    assignees: z.array(assigneeInputSchema).default([]),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
    path: ['endTime'],
  });

export const createSchedulePlansBatchBodySchema = z.object({
  orderId: z.string().trim().min(1, 'Thiếu mã đơn hàng'),
  plans: z.array(batchPlanInputSchema).min(1, 'Danh sách kế hoạch phải có ít nhất 1 dòng'),
});

// PATCH /schedule-plans/batch/status — cập nhật trạng thái nhiều dòng cùng lúc trong 1 transaction
// (docs/api/more-require.md mục (l): "hủy nhiều dòng cùng lúc"), tránh phải gọi tuần tự PATCH .../status
// cho từng dòng (kém an toàn hơn khi lỗi giữa chừng). Giới hạn 2 đích CONFIRMED/CANCELLED — cùng phạm vi
// hành động Manager được phép ở updateSchedulePlanStatus (IN_PROGRESS/COMPLETED thuộc quyền Leader/
// Technical, gắn với đúng 1 người thi công nên không có nhu cầu batch).
export const batchUpdateSchedulePlanStatusBodySchema = z.object({
  planIds: z.array(z.string().trim().min(1)).min(1, 'Danh sách planIds phải có ít nhất 1 mã'),
  status: z.enum(['CONFIRMED', 'CANCELLED'], { message: 'status không hợp lệ, chỉ chấp nhận CONFIRMED hoặc CANCELLED' }),
  notes: z.string().trim().optional(),
});

// POST /schedule-plans/:planId/warehouse-movement (docs/api/api.md gap (g)) — Leader ghi nhận danh sách
// thiết bị kho doanh nghiệp đã thực xuất tại hiện trường (TSK-SETUP), có thể khác/nhiều hơn
// order_items gốc nếu đổi/bổ sung thiết bị ngay tại chỗ.
const warehouseMovementLineSchema = z.object({
  itemId: z.string().trim().min(1, 'Thiếu mã thiết bị'),
  quantity: z.coerce.number().int().positive('Số lượng phải lớn hơn 0'),
});
export const warehouseMovementBodySchema = z.object({
  items: z.array(warehouseMovementLineSchema).min(1, 'Danh sách thiết bị phải có ít nhất 1 dòng'),
  notes: z.string().trim().optional(),
});

export const listWorkTasksQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const listAttendancesQuerySchema = z.object({
  orderId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});


export type CheckInBody = z.infer<typeof checkInBodySchema>;
export type CheckOutBody = z.infer<typeof checkOutBodySchema>;
export type WarehouseMovementBody = z.infer<typeof warehouseMovementBodySchema>;
export type AttachEvidenceBody = z.infer<typeof attachEvidenceBodySchema>;
export type PlanIdParam = z.infer<typeof planIdParamSchema>;
export type BatchUpdateSchedulePlanStatusBody = z.infer<typeof batchUpdateSchedulePlanStatusBodySchema>;
export type AssigneeParam = z.infer<typeof assigneeParamSchema>;
export type ListSchedulePlansQuery = z.infer<typeof listSchedulePlansQuerySchema>;
export type ListWorkTasksQuery = z.infer<typeof listWorkTasksQuerySchema>;
export type ListAttendancesQuery = z.infer<typeof listAttendancesQuerySchema>;
export type CreateSchedulePlanBody = z.infer<typeof createSchedulePlanBodySchema>;
export type UpdateSchedulePlanBody = z.infer<typeof updateSchedulePlanBodySchema>;
export type UpdateSchedulePlanStatusBody = z.infer<typeof updateSchedulePlanStatusBodySchema>;
export type AddAssigneeBody = z.infer<typeof addAssigneeBodySchema>;
export type CreateSchedulePlansBatchBody = z.infer<typeof createSchedulePlansBatchBodySchema>;
export type BatchPlanInput = z.infer<typeof batchPlanInputSchema>;

export const taskIdParamSchema = z.object({
  taskId: z.string().uuid('Mã công việc không hợp lệ (phải là UUID)'),
});

export const createWorkTaskBodySchema = z.object({
  taskCode: z.string().trim().min(1, 'Mã công việc không được để trống'),
  taskName: z.string().trim().min(1, 'Tên công việc không được để trống'),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const updateWorkTaskBodySchema = z.object({
  taskCode: z.string().trim().min(1, 'Mã công việc không được để trống').optional(),
  taskName: z.string().trim().min(1, 'Tên công việc không được để trống').optional(),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
export type CreateWorkTaskBody = z.infer<typeof createWorkTaskBodySchema>;
export type UpdateWorkTaskBody = z.infer<typeof updateWorkTaskBodySchema>;
