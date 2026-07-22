import type { PlanMemberRole, ScheduleStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { inventoryService, type MovementDTO } from '../inventory/inventory.service';
import { scheduleRepository, type SchedulePlanWithDetails } from './schedule.repository';
import type {
  AddAssigneeBody,
  BatchUpdateSchedulePlanStatusBody,
  CreateSchedulePlanBody,
  CreateSchedulePlansBatchBody,
  ListSchedulePlansQuery,
  UpdateSchedulePlanBody,
  UpdateSchedulePlanStatusBody,
  WarehouseMovementBody,
} from './schedule.validators';

export interface Actor {
  id: string;
  role: 'ADMIN' | 'MANAGER' | 'LEADER' | 'TECHNICAL';
}

export interface AssigneeDTO {
  userId: string;
  fullName: string;
  role: PlanMemberRole;
  phone: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  // docs/api/api.md gap (p) — Staff app cần đọc lại ảnh check-in đã chụp; FE tự gọi thêm
  // GET /evidence/:id với giá trị này để lấy fileUrl.
  checkInEvidenceId: string | null;
}

export interface SchedulePlanDTO {
  planId: string;
  planCode: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  // docs/api/api.md gap (o) — Staff app hiển thị "Thông tin khách hàng" (số điện thoại + nút gọi, địa
  // chỉ) cho mọi loại việc, không chỉ SETUP/COLLECT.
  customerPhone: string;
  customerAddress: string | null;
  eventName: string | null;
  eventDate: string;
  orderLocation: string;
  taskId: string;
  // docs/api/api.md gap (o) — dùng để gate UI theo loại việc (SurveyReportSection/
  // WarehouseMovementSection/...) thay vì phải tự map taskId qua catalog GET /work-tasks.
  taskCode: string;
  taskName: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  status: ScheduleStatus;
  evidenceId: string | null;
  notes: string | null;
  assignees: AssigneeDTO[];
}

export interface WorkTaskDTO {
  taskId: string;
  taskCode: string;
  taskName: string;
  description: string | null;
}

const TERMINAL_OR_LOCKED_STATUSES: ScheduleStatus[] = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const ELIGIBLE_ASSIGNEE_USER_ROLES = ['LEADER', 'TECHNICAL'];

function mapAssignee(a: {
  userId: string;
  role: PlanMemberRole;
  user: { fullName: string; phone: string | null };
  attendance: { checkInAt: Date | null; checkOutAt: Date | null; checkInEvidenceId: string | null } | null;
}): AssigneeDTO {
  return {
    userId: a.userId,
    fullName: a.user.fullName,
    role: a.role,
    phone: a.user.phone,
    checkInAt: a.attendance?.checkInAt ? a.attendance.checkInAt.toISOString() : null,
    checkOutAt: a.attendance?.checkOutAt ? a.attendance.checkOutAt.toISOString() : null,
    checkInEvidenceId: a.attendance?.checkInEvidenceId ?? null,
  };
}

function mapPlan(row: SchedulePlanWithDetails): SchedulePlanDTO {
  return {
    planId: row.planId,
    planCode: row.planCode,
    orderId: row.orderId,
    orderCode: row.order.orderCode,
    customerName: row.order.customer.customerName,
    customerPhone: row.order.customer.phone,
    customerAddress: row.order.customer.address,
    eventName: row.order.eventName,
    eventDate: row.order.eventDate.toISOString(),
    orderLocation: row.order.location,
    taskId: row.taskId,
    taskCode: row.task.taskCode,
    taskName: row.task.taskName,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime ? row.endTime.toISOString() : null,
    location: row.location,
    status: row.status,
    evidenceId: row.evidenceId,
    notes: row.notes,
    assignees: row.assignees.map(mapAssignee),
  };
}

async function findPlanOrThrow(planId: string): Promise<SchedulePlanWithDetails> {
  const plan = await scheduleRepository.findById(planId);
  if (!plan) throw AppError.notFound('Schedule plan not found');
  return plan;
}

async function validateAssigneeInputs(assignees: { userId: string; role: PlanMemberRole }[]): Promise<void> {
  for (const a of assignees) {
    const user = await scheduleRepository.findUserById(a.userId);
    if (!user) throw AppError.notFound(`User not found: ${a.userId}`, { userId: a.userId });
    if (!ELIGIBLE_ASSIGNEE_USER_ROLES.includes(user.role)) {
      throw AppError.badRequest(`User ${a.userId} không có vai trò LEADER/TECHNICAL, không thể phân công`, {
        userId: a.userId,
        role: user.role,
      });
    }
  }
}

// Tối đa 1 LEAD/plan (Note gốc của schedule_plan_assignees trong docs/schema.full.dbml, xác nhận lại ở
// docs/api/more-require.md mục (ae) điểm 3) — bắt buộc phải đúng 1 LEAD để suy status tự động từ đúng 1
// mốc chấm công duy nhất khi có nhiều assignee trên cùng 1 plan.
function assertAtMostOneLead(assignees: { role: PlanMemberRole }[]): void {
  const leadCount = assignees.filter((a) => a.role === 'LEAD').length;
  if (leadCount > 1) {
    throw AppError.badRequest('Mỗi kế hoạch chỉ được phân công tối đa 1 người vai trò LEAD');
  }
}

async function listSchedulePlans(
  query: ListSchedulePlansQuery,
): Promise<{ data: SchedulePlanDTO[]; meta: { page: number | null; limit: number | null; totalItems: number; totalPages: number | null } }> {
  const paginated = query.page !== undefined || query.limit !== undefined;
  const page = query.page ?? 1;
  const limit = query.limit ?? 500;
  const skip = paginated ? (page - 1) * limit : undefined;
  const take = paginated ? limit : undefined;

  const { rows, totalItems } = await scheduleRepository.findMany({
    orderId: query.orderId,
    status: query.status,
    taskId: query.taskId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    assigneeUserId: query.assigneeUserId,
    skip,
    take,
  });

  return {
    data: rows.map(mapPlan),
    meta: paginated
      ? { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
      : { page: null, limit: null, totalItems, totalPages: null },
  };
}

async function getSchedulePlanById(planId: string): Promise<SchedulePlanDTO> {
  const plan = await findPlanOrThrow(planId);
  return mapPlan(plan);
}

async function createSchedulePlan(body: CreateSchedulePlanBody, createdBy: string): Promise<SchedulePlanDTO> {
  const order = await scheduleRepository.orderExists(body.orderId);
  if (!order) throw AppError.notFound('Order not found');

  const task = await scheduleRepository.taskExists(body.taskId);
  if (!task) throw AppError.notFound('Work task not found');

  await validateAssigneeInputs(body.assignees);
  assertAtMostOneLead(body.assignees);

  const planCode = await scheduleRepository.generateNextPlanCode();
  const created = await scheduleRepository.create({
    planCode,
    orderId: body.orderId,
    taskId: body.taskId,
    startTime: body.startTime,
    endTime: body.endTime ?? null,
    location: body.location ?? null,
    notes: body.notes || null,
    createdBy,
    assignees: body.assignees,
  });

  return mapPlan(created);
}

async function updateSchedulePlan(planId: string, body: UpdateSchedulePlanBody): Promise<SchedulePlanDTO> {
  const existing = await findPlanOrThrow(planId);
  if (TERMINAL_OR_LOCKED_STATUSES.includes(existing.status)) {
    throw AppError.badRequest(`Không thể sửa kế hoạch đang ở trạng thái ${existing.status}`);
  }

  const updated = await scheduleRepository.update(planId, {
    startTime: body.startTime,
    endTime: body.endTime ?? null,
    location: body.location ?? null,
    notes: body.notes || null,
  });
  return mapPlan(updated);
}

// Ranh giới vai trò: Manager tự gọi tay CONFIRMED/CANCELLED trên web (đã chốt ở docs/api/
// more-require.md mục (ae), 2026-07-21). Nới thêm cho LEADER (docs/api/api.md gap (c), đã chốt lại
// 2026-07-22): Leader được TỰ xác nhận kế hoạch của chính mình (CONFIRMED) ngay trên app, nhưng KHÔNG
// được tự hủy (CANCELLED vẫn chỉ Manager) và chỉ áp dụng cho plan họ giữ vai trò LEAD (không phải mọi
// assignee). Chuyển IN_PROGRESS/COMPLETED không qua đây — service tự suy ra từ chấm công của assignee
// LEAD khi gọi checkIn/checkOut bên dưới.
async function updateSchedulePlanStatus(
  planId: string,
  body: UpdateSchedulePlanStatusBody,
  actor: Actor,
): Promise<SchedulePlanDTO> {
  const existing = await findPlanOrThrow(planId);

  if (actor.role === 'LEADER') {
    if (body.status !== 'CONFIRMED') {
      throw AppError.forbidden('Leader chỉ được tự xác nhận kế hoạch (CONFIRMED) — hủy kế hoạch thuộc về Manager');
    }
    const isLeadAssignee = existing.assignees.some((a) => a.userId === actor.id && a.role === 'LEAD');
    if (!isLeadAssignee) {
      throw AppError.forbidden('Chỉ Leader giữ vai trò LEAD trong kế hoạch này mới được tự xác nhận');
    }
  } else if (actor.role !== 'MANAGER') {
    throw AppError.forbidden('Chỉ Manager hoặc Leader (vai trò LEAD của kế hoạch) được xác nhận hoặc hủy kế hoạch');
  }

  if (body.status === 'CONFIRMED' && existing.status !== 'PENDING') {
    throw AppError.badRequest('Chỉ có thể xác nhận kế hoạch đang ở trạng thái PENDING');
  }
  if (body.status === 'CANCELLED' && TERMINAL_OR_LOCKED_STATUSES.includes(existing.status)) {
    throw AppError.badRequest(`Không thể hủy kế hoạch đang ở trạng thái ${existing.status}`);
  }

  const updated = await scheduleRepository.updateStatus(planId, body.status, body.notes, body.evidenceId);
  return mapPlan(updated);
}

async function addAssignee(planId: string, body: AddAssigneeBody): Promise<SchedulePlanDTO> {
  const existing = await findPlanOrThrow(planId);
  if (TERMINAL_OR_LOCKED_STATUSES.includes(existing.status)) {
    throw AppError.badRequest(`Không thể thêm nhân sự khi kế hoạch đang ở trạng thái ${existing.status}`);
  }

  await validateAssigneeInputs([body]);

  const alreadyAssigned = existing.assignees.some((a) => a.userId === body.userId);
  if (alreadyAssigned) {
    throw new AppError(409, 'ALREADY_ASSIGNED', 'Nhân sự này đã được phân công vào kế hoạch');
  }

  if (body.role === 'LEAD' && existing.assignees.some((a) => a.role === 'LEAD')) {
    throw new AppError(409, 'LEAD_ALREADY_ASSIGNED', 'Kế hoạch này đã có người vai trò LEAD');
  }

  await scheduleRepository.addAssignee(planId, body.userId, body.role);
  return getSchedulePlanById(planId);
}

async function removeAssignee(planId: string, userId: string): Promise<SchedulePlanDTO> {
  const existing = await findPlanOrThrow(planId);
  if (TERMINAL_OR_LOCKED_STATUSES.includes(existing.status)) {
    throw AppError.badRequest(`Không thể gỡ nhân sự khi kế hoạch đang ở trạng thái ${existing.status}`);
  }

  const assignee = existing.assignees.find((a) => a.userId === userId);
  if (!assignee) throw AppError.notFound('Assignee not found on this schedule plan');

  await scheduleRepository.removeAssignee(planId, userId);
  return getSchedulePlanById(planId);
}

// Đã chốt ở docs/api/more-require.md mục (ae) (2026-07-21): status tự suy ra từ chấm công của assignee
// LEAD (chỉ đúng 1 người/plan, xem assertAtMostOneLead) — check-in của LEAD đưa plan sang IN_PROGRESS,
// check-out của LEAD đưa plan sang COMPLETED. Check-in/check-out của TECHNICAL chỉ ghi nhận chấm công cá
// nhân, không đụng tới status. Bỏ qua khi plan đã CANCELLED để không hồi sinh 1 kế hoạch đã hủy.
async function checkIn(
  planId: string,
  userId: string,
  actor: Actor,
  checkInEvidenceId?: string,
): Promise<SchedulePlanDTO> {
  if (actor.id !== userId) {
    throw AppError.forbidden('Chỉ chính nhân sự được phân công mới được check-in cho bản thân');
  }

  const plan = await findPlanOrThrow(planId);
  const assignee = plan.assignees.find((a) => a.userId === userId);
  if (!assignee) throw AppError.notFound('Assignee not found on this schedule plan');
  if (assignee.attendance?.checkInAt) {
    throw AppError.badRequest('Đã check-in trước đó');
  }

  await scheduleRepository.checkIn(assignee.assigneeId, checkInEvidenceId);
  if (assignee.role === 'LEAD' && plan.status !== 'CANCELLED') {
    await scheduleRepository.updateStatus(planId, 'IN_PROGRESS', undefined, undefined);
  }

  return getSchedulePlanById(planId);
}

async function checkOut(planId: string, userId: string, actor: Actor): Promise<SchedulePlanDTO> {
  if (actor.id !== userId) {
    throw AppError.forbidden('Chỉ chính nhân sự được phân công mới được check-out cho bản thân');
  }

  const plan = await findPlanOrThrow(planId);
  const assignee = plan.assignees.find((a) => a.userId === userId);
  if (!assignee) throw AppError.notFound('Assignee not found on this schedule plan');
  if (!assignee.attendance?.checkInAt) {
    throw AppError.badRequest('Chưa check-in, không thể check-out');
  }
  if (assignee.attendance.checkOutAt) {
    throw AppError.badRequest('Đã check-out trước đó');
  }

  await scheduleRepository.checkOut(assignee.assigneeId);
  if (assignee.role === 'LEAD' && plan.status !== 'CANCELLED') {
    await scheduleRepository.updateStatus(planId, 'COMPLETED', undefined, undefined);
  }

  return getSchedulePlanById(planId);
}

// Gắn schedule_plans.evidence_id độc lập với transition status (docs/api/more-require.md mục (ag)) —
// thay cho đường cũ PATCH .../status { COMPLETED, evidenceId } không còn dùng được. Không bắt buộc,
// không gắn điều kiện status nào ("tách biệt hoàn toàn") — bất kỳ assignee nào (LEAD/TECHNICAL) của plan
// đều gắn được, không riêng người check-in/out.
async function attachEvidence(planId: string, evidenceId: string, actor: Actor): Promise<SchedulePlanDTO> {
  const plan = await findPlanOrThrow(planId);
  const isAssigned = plan.assignees.some((a) => a.userId === actor.id);
  if (!isAssigned) {
    throw AppError.forbidden('Chỉ nhân sự được phân công vào kế hoạch này mới được gắn ảnh minh chứng');
  }

  await scheduleRepository.attachEvidence(planId, evidenceId);
  return getSchedulePlanById(planId);
}

async function listWorkTasks(): Promise<WorkTaskDTO[]> {
  const rows = await scheduleRepository.listWorkTasks();
  return rows.map((t) => ({ taskId: t.taskId, taskCode: t.taskCode, taskName: t.taskName, description: t.description }));
}

// Không có DELETE thật trong đặc tả gốc (docs/api/kehoachvaphancong_api.md mục 11.1 khuyến nghị dùng
// PATCH .../status CANCELLED) — cung cấp thêm endpoint xóa cứng theo yêu cầu, nhưng chỉ cho phép khi
// kế hoạch CHƯA từng CONFIRMED/thi công (PENDING) hoặc ĐÃ hủy (CANCELLED), để không mất dấu vết của kế
// hoạch đang/đã triển khai thật.
const DELETABLE_STATUSES: ScheduleStatus[] = ['PENDING', 'CANCELLED'];

async function deleteSchedulePlan(planId: string): Promise<void> {
  const existing = await findPlanOrThrow(planId);
  if (!DELETABLE_STATUSES.includes(existing.status)) {
    throw AppError.badRequest(
      `Không thể xóa kế hoạch đang ở trạng thái ${existing.status} — chỉ xóa được PENDING hoặc CANCELLED, các trạng thái khác hãy hủy qua PATCH /schedule-plans/:id/status`,
    );
  }
  await scheduleRepository.delete(planId);
}

// POST /schedule-plans/batch (docs/api/kehoachvaphancong_api.md mục 8.5 điểm 2) — tạo nhiều dòng cùng
// order_id trong 1 transaction, tránh trạng thái lưu dở dang nếu gọi POST tuần tự bị lỗi giữa chừng.
async function createSchedulePlansBatch(body: CreateSchedulePlansBatchBody, createdBy: string): Promise<SchedulePlanDTO[]> {
  const order = await scheduleRepository.orderExists(body.orderId);
  if (!order) throw AppError.notFound('Order not found');

  for (const plan of body.plans) {
    const task = await scheduleRepository.taskExists(plan.taskId);
    if (!task) throw AppError.notFound(`Work task not found: ${plan.taskId}`, { taskId: plan.taskId });
    await validateAssigneeInputs(plan.assignees);
    assertAtMostOneLead(plan.assignees);
  }

  const created = await scheduleRepository.createBatch(
    body.orderId,
    createdBy,
    body.plans.map((plan) => ({
      taskId: plan.taskId,
      startTime: plan.startTime,
      endTime: plan.endTime ?? null,
      location: plan.location ?? null,
      notes: plan.notes ?? null,
      assignees: plan.assignees,
    })),
  );

  return created.map(mapPlan);
}

// PATCH /schedule-plans/batch/status — cập nhật trạng thái nhiều dòng cùng lúc trong 1 transaction
// (docs/api/more-require.md mục (l)), tránh trạng thái lưu dở dang nếu gọi PATCH .../status tuần tự bị
// lỗi giữa chừng. Route chỉ cho Manager gọi (giống POST /batch) nên không cần actor/role guard ở đây —
// vẫn giữ nguyên các ràng buộc chuyển trạng thái CONFIRMED/CANCELLED đã áp dụng cho endpoint đơn lẻ.
async function updateSchedulePlansStatusBatch(body: BatchUpdateSchedulePlanStatusBody): Promise<SchedulePlanDTO[]> {
  const plans = await Promise.all(body.planIds.map((planId) => findPlanOrThrow(planId)));

  for (const plan of plans) {
    if (body.status === 'CONFIRMED' && plan.status !== 'PENDING') {
      throw AppError.badRequest(`Kế hoạch ${plan.planCode} không ở trạng thái PENDING, không thể xác nhận`);
    }
    if (body.status === 'CANCELLED' && TERMINAL_OR_LOCKED_STATUSES.includes(plan.status)) {
      throw AppError.badRequest(`Kế hoạch ${plan.planCode} đang ở trạng thái ${plan.status}, không thể hủy`);
    }
  }

  const updated = await scheduleRepository.updateStatusBatch(body.planIds, body.status, body.notes);
  return updated.map(mapPlan);
}

export type AggregateScheduleStatus = 'CANCELLED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CONFIRMED';

// Thuật toán tổng hợp trạng thái nhiều dòng schedule_plans cùng order_id thành 1 badge — đề xuất ở
// docs/api/kehoachvaphancong_api.md mục 7 (đã chốt logic 6 case, style hiển thị FE tự quyết định).
export function computeAggregateStatus(statuses: ScheduleStatus[]): AggregateScheduleStatus | null {
  if (statuses.length === 0) return null;
  if (statuses.every((s) => s === 'CANCELLED')) return 'CANCELLED';

  const active = statuses.filter((s) => s !== 'CANCELLED');
  if (active.some((s) => s === 'IN_PROGRESS')) return 'IN_PROGRESS';

  const hasConfirmed = active.some((s) => s === 'CONFIRMED');
  const hasCompleted = active.some((s) => s === 'COMPLETED');
  if (hasConfirmed && hasCompleted) return 'IN_PROGRESS';
  if (active.every((s) => s === 'COMPLETED')) return 'COMPLETED';
  if (active.every((s) => s === 'CONFIRMED')) return 'CONFIRMED';
  return 'PENDING';
}

// POST /schedule-plans/:planId/warehouse-movement (docs/api/api.md gap (g)) — chỉ delegate sang
// inventoryService (nghiệp vụ + hiệu ứng tồn kho thuộc domain Inventory), giữ đúng layering: controller
// chỉ gọi service của module mình, composition liên module nằm ở tầng service (giống mobile.service.ts).
function recordWarehouseMovement(planId: string, body: WarehouseMovementBody, actor: Actor): Promise<MovementDTO[]> {
  return inventoryService.recordFieldOutbound(planId, body, actor);
}

export const scheduleService = {
  listSchedulePlans,
  getSchedulePlanById,
  createSchedulePlan,
  updateSchedulePlan,
  updateSchedulePlanStatus,
  addAssignee,
  removeAssignee,
  checkIn,
  checkOut,
  attachEvidence,
  listWorkTasks,
  deleteSchedulePlan,
  createSchedulePlansBatch,
  updateSchedulePlansStatusBatch,
  recordWarehouseMovement,
};
