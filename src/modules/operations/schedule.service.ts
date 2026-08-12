import type { PlanMemberRole, ScheduleStatus } from '@prisma/client';
import { calculateDistanceMeters } from '../../utils/geo.utils';
import { AppError } from '../../utils/AppError';
import { inventoryService, type MovementDTO } from '../inventory/inventory.service';
import { scheduleRepository, type SchedulePlanWithDetails } from './schedule.repository';
import type {
  AddAssigneeBody,
  BatchUpdateSchedulePlanStatusBody,
  CreateSchedulePlanBody,
  CreateSchedulePlansBatchBody,
  ListSchedulePlansQuery,
  ListWorkTasksQuery,
  UpdateSchedulePlanBody,
  UpdateSchedulePlanStatusBody,
  WarehouseMovementBody,
  CreateWorkTaskBody,
  UpdateWorkTaskBody,
  ListAttendancesQuery,
} from './schedule.validators';

export interface Actor {
  id: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
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
  latitude: number | null;
  longitude: number | null;
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
  orderEndDate: string | null;
  orderLocation: string;
  taskId: string;
  // docs/api/api.md gap (o) — dùng để gate UI theo loại việc (SurveyReportSection/
  // WarehouseMovementSection/...) thay vì phải tự map taskId qua catalog GET /work-tasks.
  taskCode: string;
  taskName: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ScheduleStatus;
  evidenceIds: string[];
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
const ELIGIBLE_ASSIGNEE_USER_ROLES = ['STAFF'];

function mapAssignee(a: {
  userId: string;
  role: PlanMemberRole;
  user: { fullName: string; phone: string | null };
  attendance: { checkInAt: Date | null; checkOutAt: Date | null; checkInEvidenceId: string | null; latitude: number | null; longitude: number | null } | null;
}): AssigneeDTO {
  return {
    userId: a.userId,
    fullName: a.user.fullName,
    role: a.role,
    phone: a.user.phone,
    checkInAt: a.attendance?.checkInAt ? a.attendance.checkInAt.toISOString() : null,
    checkOutAt: a.attendance?.checkOutAt ? a.attendance.checkOutAt.toISOString() : null,
    checkInEvidenceId: a.attendance?.checkInEvidenceId ?? null,
    latitude: a.attendance?.latitude ?? null,
    longitude: a.attendance?.longitude ?? null,
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
    orderEndDate: row.order.endDate ? row.order.endDate.toISOString() : null,
    orderLocation: row.order.location,
    taskId: row.taskId,
    taskCode: row.task.taskCode,
    taskName: row.task.taskName,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime ? row.endTime.toISOString() : null,
    location: row.location,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    evidenceIds: row.evidences ? row.evidences.map((e) => e.evidenceId) : [],
    notes: row.notes,
    assignees: row.assignees.map(mapAssignee),
  };
}

async function findPlanOrThrow(planId: string): Promise<SchedulePlanWithDetails> {
  const plan = await scheduleRepository.findById(planId);
  if (!plan) throw AppError.notFound('Không tìm thấy kế hoạch lịch trình');
  return plan;
}

async function validateAssigneeInputs(assignees: { userId: string; role: PlanMemberRole }[]): Promise<void> {
  for (const a of assignees) {
    const user = await scheduleRepository.findUserById(a.userId);
    if (!user) throw AppError.notFound(`Không tìm thấy người dùng: ${a.userId}`, { userId: a.userId });
    if (!ELIGIBLE_ASSIGNEE_USER_ROLES.includes(user.role)) {
      throw AppError.badRequest(`User ${a.userId} không có vai trò STAFF, không thể phân công`, {
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
  actor: Actor,
): Promise<{ data: SchedulePlanDTO[]; meta: { page: number | null; limit: number | null; totalItems: number; totalPages: number | null } }> {
  const paginated = query.page !== undefined || query.limit !== undefined;
  const page = query.page ?? 1;
  const limit = query.limit ?? 500;
  const skip = paginated ? (page - 1) * limit : undefined;
  const take = paginated ? limit : undefined;

  // Scope theo quyền: STAFF chỉ được xem lịch của đơn mình được phân công — ÉP assigneeUserId = id trong
  // token, BỎ QUA giá trị client tự truyền (chống IDOR: đổi/bỏ assigneeUserId để xem lịch người khác).
  // MANAGER/ADMIN xem theo filter tùy ý (không truyền assigneeUserId → thấy hết).
  const assigneeUserId = actor.role === 'STAFF' ? actor.id : query.assigneeUserId;

  const { rows, totalItems } = await scheduleRepository.findMany({
    orderId: query.orderId,
    status: query.status,
    taskId: query.taskId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    dateMode: query.dateMode ?? 'timeline',
    assigneeUserId,
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

async function getSchedulePlanById(planId: string, actor?: Actor): Promise<SchedulePlanDTO> {
  const plan = await findPlanOrThrow(planId);
  // STAFF chỉ đọc được kế hoạch mình có tham gia. Trả 404 (giống khi không tồn tại) để không lộ sự tồn
  // tại của kế hoạch không liên quan. Lời gọi NỘI BỘ (không truyền actor) đã tự kiểm quyền trước đó nên bỏ qua.
  if (actor?.role === 'STAFF' && !plan.assignees.some((a) => a.userId === actor.id)) {
    throw AppError.notFound('Không tìm thấy kế hoạch lịch trình');
  }
  return mapPlan(plan);
}

async function createSchedulePlan(body: CreateSchedulePlanBody, createdBy: string): Promise<SchedulePlanDTO> {
  const order = await scheduleRepository.orderExists(body.orderId);
  if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');

  const task = await scheduleRepository.taskExists(body.taskId);
  if (!task) throw AppError.notFound('Không tìm thấy đầu việc');

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
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    notes: body.notes || null,
    createdBy,
    assignees: body.assignees,
  });

  await scheduleRepository.syncOrderDates(created.orderId);
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
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    notes: body.notes || null,
  });
  await scheduleRepository.syncOrderDates(updated.orderId);
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

  if (actor.role === 'STAFF') {
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

  const updated = await scheduleRepository.updateStatus(planId, body.status, body.notes, body.evidenceIds);
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
  if (!assignee) throw AppError.notFound('Không tìm thấy nhân sự được phân công trong kế hoạch này');

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
  latitude?: number,
  longitude?: number,
): Promise<SchedulePlanDTO> {
  if (actor.id !== userId) {
    throw AppError.forbidden('Chỉ chính nhân sự được phân công mới được check-in cho bản thân');
  }

  const plan = await findPlanOrThrow(planId);

  if (latitude !== undefined && longitude !== undefined) {
    const orderLat = plan.order.latitude;
    const orderLng = plan.order.longitude;
    if (orderLat !== null && orderLng !== null) {
      const distance = calculateDistanceMeters(latitude, longitude, orderLat, orderLng);
      const maxDistance = Number(process.env.MAX_CHECKIN_DISTANCE_METERS) || 500;
      if (distance > maxDistance) {
        throw AppError.badRequest('Vị trí check-in nằm ngoài phạm vi cho phép');
      }
    }
  }


  const assignee = plan.assignees.find((a) => a.userId === userId);
  if (!assignee) throw AppError.notFound('Không tìm thấy nhân sự được phân công trong kế hoạch này');
  if (assignee.attendance?.checkInAt) {
    throw AppError.badRequest('Đã check-in trước đó');
  }

  await scheduleRepository.checkIn(assignee.assigneeId, checkInEvidenceId, latitude, longitude);
  if (plan.status !== 'CANCELLED') {
    // BẤT KỲ check-in nào (mọi loại lịch: khảo sát/lắp đặt/thu hồi, mọi vai trò) = có người bắt đầu làm
    // → đơn CONFIRMED tự chuyển IN_PROGRESS. Guard "chỉ tiến" (updateMany where CONFIRMED) nằm trong repo
    // nên idempotent, không lùi COMPLETED/CANCELLED. (Trước đây chỉ LEAD check-in lịch Lắp đặt mới đổi.)
    await scheduleRepository.promoteOrderToInProgress(plan.orderId);
    // Riêng LEAD check-in mới đưa PLAN sang IN_PROGRESS (mốc cấp lịch trình, khác mốc cấp đơn ở trên).
    if (assignee.role === 'LEAD') {
      await scheduleRepository.updateStatus(planId, 'IN_PROGRESS', undefined, undefined);
    }
  }

  return getSchedulePlanById(planId);
}

async function checkOut(planId: string, userId: string, actor: Actor, latitude?: number, longitude?: number): Promise<SchedulePlanDTO> {
  if (actor.id !== userId) {
    throw AppError.forbidden('Chỉ chính nhân sự được phân công mới được check-out cho bản thân');
  }

  const plan = await findPlanOrThrow(planId);
  const assignee = plan.assignees.find((a) => a.userId === userId);
  if (!assignee) throw AppError.notFound('Không tìm thấy nhân sự được phân công trong kế hoạch này');
  if (!assignee.attendance?.checkInAt) {
    throw AppError.badRequest('Chưa check-in, không thể check-out');
  }
  if (assignee.attendance.checkOutAt) {
    throw AppError.badRequest('Đã check-out trước đó');
  }

  await scheduleRepository.checkOut(assignee.assigneeId, latitude, longitude);
  if (assignee.role === 'LEAD' && plan.status !== 'CANCELLED') {
    await scheduleRepository.updateStatus(planId, 'COMPLETED', undefined, undefined);
  }

  return getSchedulePlanById(planId);
}

// Gắn schedule_plans.evidence_id độc lập với transition status (docs/api/more-require.md mục (ag)) —
// thay cho đường cũ PATCH .../status { COMPLETED, evidenceId } không còn dùng được. Không bắt buộc,
// không gắn điều kiện status nào ("tách biệt hoàn toàn") — bất kỳ assignee nào (LEAD/TECHNICAL) của plan
// đều gắn được, không riêng người check-in/out.
async function attachEvidence(planId: string, evidenceIds: string[], actor: Actor): Promise<SchedulePlanDTO> {
  const plan = await findPlanOrThrow(planId);
  const isAssigned = plan.assignees.some((a) => a.userId === actor.id);
  if (!isAssigned) {
    throw AppError.forbidden('Chỉ nhân sự được phân công vào kế hoạch này mới được gắn ảnh minh chứng');
  }

  await scheduleRepository.attachEvidence(planId, evidenceIds);
  return getSchedulePlanById(planId);
}
async function listWorkTasks(query: ListWorkTasksQuery) {
  const paginated = query.page !== undefined || query.limit !== undefined;
  const page = query.page ?? 1;
  const limit = query.limit ?? 500;
  const skip = paginated ? (page - 1) * limit : undefined;
  const take = paginated ? limit : undefined;

  const { rows, totalItems } = await scheduleRepository.listWorkTasks(skip, take, query.search);
  return {
    data: rows.map((t) => ({ taskId: t.taskId, taskCode: t.taskCode, taskName: t.taskName, description: t.description, isActive: t.isActive })),
    meta: paginated
      ? { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
      : { page: null, limit: null, totalItems, totalPages: null },
  };
}

async function getWorkTask(taskId: string) {
  const task = await scheduleRepository.getWorkTaskById(taskId);
  if (!task) throw AppError.notFound('Không tìm thấy Work Task');
  return { taskId: task.taskId, taskCode: task.taskCode, taskName: task.taskName, description: task.description, isActive: task.isActive };
}

async function createWorkTask(data: CreateWorkTaskBody) {
  const existing = await scheduleRepository.getWorkTaskByCode(data.taskCode);
  if (existing) throw AppError.badRequest('Mã công việc đã tồn tại');
  
  const created = await scheduleRepository.createWorkTask({
    taskCode: data.taskCode,
    taskName: data.taskName,
    description: data.description,
    isActive: data.isActive ?? true,
  });
  
  return { taskId: created.taskId, taskCode: created.taskCode, taskName: created.taskName, description: created.description, isActive: created.isActive };
}

async function updateWorkTask(taskId: string, data: UpdateWorkTaskBody) {
  const existing = await scheduleRepository.getWorkTaskById(taskId);
  if (!existing) throw AppError.notFound('Không tìm thấy Work Task');

  if (data.taskCode && data.taskCode !== existing.taskCode) {
    const codeConflict = await scheduleRepository.getWorkTaskByCode(data.taskCode);
    if (codeConflict) throw AppError.badRequest('Mã công việc đã tồn tại');
  }

  const updated = await scheduleRepository.updateWorkTask(taskId, {
    taskCode: data.taskCode,
    taskName: data.taskName,
    description: data.description,
    isActive: data.isActive,
  });

  return { taskId: updated.taskId, taskCode: updated.taskCode, taskName: updated.taskName, description: updated.description, isActive: updated.isActive };
}

async function deleteWorkTask(taskId: string) {
  const existing = await scheduleRepository.getWorkTaskById(taskId);
  if (!existing) throw AppError.notFound('Không tìm thấy Work Task');
  
  await scheduleRepository.updateWorkTask(taskId, { isActive: false });
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
  await scheduleRepository.syncOrderDates(existing.orderId);
}

// POST /schedule-plans/batch (docs/api/kehoachvaphancong_api.md mục 8.5 điểm 2) — tạo nhiều dòng cùng
// order_id trong 1 transaction, tránh trạng thái lưu dở dang nếu gọi POST tuần tự bị lỗi giữa chừng.
async function createSchedulePlansBatch(body: CreateSchedulePlansBatchBody, createdBy: string): Promise<SchedulePlanDTO[]> {
  const order = await scheduleRepository.orderExists(body.orderId);
  if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');

  for (const plan of body.plans) {
    const task = await scheduleRepository.taskExists(plan.taskId);
    if (!task) throw AppError.notFound(`Không tìm thấy đầu việc: ${plan.taskId}`, { taskId: plan.taskId });
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
      latitude: plan.latitude ?? null,
      longitude: plan.longitude ?? null,
      notes: plan.notes ?? null,
      assignees: plan.assignees,
    })),
  );

  await scheduleRepository.syncOrderDates(body.orderId);
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

async function listAttendances(query: ListAttendancesQuery) {
  const paginated = query.page !== undefined || query.limit !== undefined;
  const page = query.page ?? 1;
  const limit = query.limit ?? 500;
  const skip = paginated ? (page - 1) * limit : undefined;
  const take = paginated ? limit : undefined;

  const { rows, totalItems } = await scheduleRepository.listAttendances(skip, take, query.orderId, query.search, query.taskId);
  return {
    data: rows,
    meta: paginated
      ? { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
      : { page: null, limit: null, totalItems, totalPages: null },
  };
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
  getWorkTask,
  createWorkTask,
  updateWorkTask,
  deleteWorkTask,
  deleteSchedulePlan,
  createSchedulePlansBatch,
  updateSchedulePlansStatusBatch,
  recordWarehouseMovement,
  listAttendances,
};
