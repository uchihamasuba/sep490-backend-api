import type { PlanMemberRole, ScheduleStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface SchedulePlanListFilter {
  orderId?: string;
  status?: ScheduleStatus;
  taskId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  dateMode?: 'timeline' | 'plan';
  assigneeUserId?: string;
}

export interface SchedulePlanListParams extends SchedulePlanListFilter {
  skip?: number;
  take?: number;
}

const detailInclude = {
  order: {
    select: {
      orderCode: true,
      eventName: true,
      eventDate: true,
      endDate: true,
      location: true,
      latitude: true,
      longitude: true,
      // customer.phone/address (docs/api/api.md gap (o)) — Staff app cần hiển thị số điện thoại/địa
      // chỉ khách hàng ở mọi loại việc, không chỉ SETUP/COLLECT.
      customer: { select: { customerName: true, phone: true, address: true } },
    },
  },
  // taskCode (docs/api/api.md gap (o)) — Staff app cần biết loại việc (TSK-SURVEY/SETUP/TEARDOWN/
  // COLLECT) để gate UI theo đúng section, không chỉ hiển thị taskName.
  task: { select: { taskId: true, taskCode: true, taskName: true } },
  assignees: {
    include: {
      user: { select: { userId: true, fullName: true, role: true, phone: true } },
      attendance: true,
    },
  },
  evidences: { select: { evidenceId: true } },
} satisfies Prisma.SchedulePlanInclude;

export type SchedulePlanWithDetails = Prisma.SchedulePlanGetPayload<{ include: typeof detailInclude }>;

function buildWhere(filter: SchedulePlanListFilter, dateMatchedOrderIds?: string[]): Prisma.SchedulePlanWhereInput {
  const where: Prisma.SchedulePlanWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.taskId) where.taskId = filter.taskId;
  if (filter.assigneeUserId) where.assignees = { some: { userId: filter.assigneeUserId } };

  // dateMode 'plan' (lịch tuần/ngày cá nhân — mobile-manager): lọc trực tiếp theo start_time của từng
  // dòng, KHÔNG kéo theo các dòng khác của cùng order nằm ngoài cửa sổ. dateTo lấy hết cả ngày cuối
  // (cộng 1 ngày, dùng lt) để khớp với cách hiểu "dateFrom..dateTo" là khoảng ngày trọn vẹn ở chế độ
  // timeline (vốn so sánh qua DATE(), luôn trọn ngày).
  if (filter.dateMode === 'plan' && (filter.dateFrom || filter.dateTo)) {
    const startTimeFilter: Prisma.DateTimeFilter = {};
    if (filter.dateFrom) startTimeFilter.gte = filter.dateFrom;
    if (filter.dateTo) {
      const dateToExclusive = new Date(filter.dateTo);
      dateToExclusive.setDate(dateToExclusive.getDate() + 1);
      startTimeFilter.lt = dateToExclusive;
    }
    where.startTime = startTimeFilter;
  }

  // orderId tường minh (trang chi tiết 1 đơn) VÀ orderId lọc theo cửa sổ ngày (tab timeline/lịch điều
  // phối đa đơn) có thể cùng xuất hiện — kết hợp bằng AND thay vì ghi đè lẫn nhau.
  const orderIdConditions: Prisma.SchedulePlanWhereInput[] = [];
  if (filter.orderId) orderIdConditions.push({ orderId: filter.orderId });
  if (dateMatchedOrderIds) orderIdConditions.push({ orderId: { in: dateMatchedOrderIds } });
  if (orderIdConditions.length === 1) Object.assign(where, orderIdConditions[0]);
  else if (orderIdConditions.length > 1) where.AND = orderIdConditions;

  return where;
}

// Xác định các order_id có khoảng [orders.event_date, MAX(schedule_plans.end_time)] giao với cửa sổ
// [dateFrom, dateTo] đang xem — đã chốt với người dùng 2026-07-20 (docs/api/lichtimeline_api.md mục
// 2.1), KHÁC với so [start_time, end_time] của riêng từng dòng schedule_plans. Trả về TOÀN BỘ dòng
// schedule_plans của các order_id khớp (không lọc riêng từng dòng theo dateFrom/dateTo) để FE có đủ dữ
// liệu tính rangeEnd và hiển thị trong drawer chi tiết (kể cả dòng nằm ngoài cửa sổ, vd khảo sát làm
// trước event_date rất lâu).
async function findDateMatchedOrderIds(dateFrom?: Date, dateTo?: Date): Promise<string[] | undefined> {
  const havingConditions: Prisma.Sql[] = [];
  if (dateTo) havingConditions.push(Prisma.sql`DATE(o.event_date) <= DATE(${dateTo})`);
  if (dateFrom) {
    // COALESCE phòng trường hợp mọi dòng của đơn đều endTime NULL — không để đơn đó bị loại hẳn khỏi
    // cửa sổ chỉ vì thiếu end_time. GREATEST phòng trường hợp mọi dòng kết thúc trước event_date.
    havingConditions.push(
      Prisma.sql`GREATEST(DATE(o.event_date), COALESCE(MAX(DATE(sp.end_time)), DATE(o.event_date))) >= DATE(${dateFrom})`,
    );
  }
  if (havingConditions.length === 0) return undefined;

  const rows = await prisma.$queryRaw<{ orderId: string }[]>(Prisma.sql`
    SELECT sp.order_id AS orderId
    FROM schedule_plans sp
    JOIN orders o ON o.order_id = sp.order_id
    GROUP BY sp.order_id, o.event_date
    HAVING ${Prisma.join(havingConditions, ' AND ')}
  `);
  return rows.map((r) => r.orderId);
}

export const scheduleRepository = {
  async findMany(params: SchedulePlanListParams) {
    const dateMatchedOrderIds =
      params.dateMode === 'plan' ? undefined : await findDateMatchedOrderIds(params.dateFrom, params.dateTo);
    const where = buildWhere(params, dateMatchedOrderIds);
    const [rows, totalItems] = await Promise.all([
      prisma.schedulePlan.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { startTime: 'asc' },
        include: detailInclude,
      }),
      prisma.schedulePlan.count({ where }),
    ]);
    return { rows, totalItems };
  },

  findById(planId: string): Promise<SchedulePlanWithDetails | null> {
    return prisma.schedulePlan.findUnique({ where: { planId }, include: detailInclude });
  },

  async generateNextPlanCode(): Promise<string> {
    const count = await prisma.schedulePlan.count();
    return `PLN-${String(count + 1).padStart(3, '0')}`;
  },

  orderExists(orderId: string) {
    return prisma.order.findUnique({ where: { orderId }, select: { orderId: true } });
  },

  taskExists(taskId: string) {
    return prisma.workTask.findUnique({ where: { taskId } });
  },

  findUserById(userId: string) {
    return prisma.user.findUnique({ where: { userId }, select: { userId: true, fullName: true, role: true } });
  },

  // Kiểm tra actor có giữ vai trò LEAD (PlanMemberRole) trên bất kỳ schedule plan nào của order —
  // dùng để giới hạn phạm vi thao tác của STAFF theo từng dự án (Leader/Technical là vai trò theo
  // project, không còn là role hệ thống). MANAGER/ADMIN không bị giới hạn bởi check này.
  async isUserLeadOnOrder(userId: string, orderId: string): Promise<boolean> {
    const assignee = await prisma.schedulePlanAssignee.findFirst({
      where: { userId, role: 'LEAD', plan: { orderId } },
      select: { assigneeId: true },
    });
    return assignee !== null;
  },

  async create(params: {
    planCode: string;
    orderId: string;
    taskId: string;
    startTime: Date;
    endTime: Date | null;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    notes: string | null;
    createdBy: string;
    assignees: { userId: string; role: PlanMemberRole }[];
  }): Promise<SchedulePlanWithDetails> {
    return prisma.schedulePlan.create({
      data: {
        planCode: params.planCode,
        orderId: params.orderId,
        taskId: params.taskId,
        startTime: params.startTime,
        endTime: params.endTime,
        location: params.location,
        latitude: params.latitude,
        longitude: params.longitude,
        notes: params.notes,
        createdBy: params.createdBy,
        assignees: { create: params.assignees.map((a) => ({ userId: a.userId, role: a.role })) },
      },
      include: detailInclude,
    });
  },

  update(
    planId: string,
    data: { startTime?: Date; endTime?: Date | null; location?: string | null; latitude?: number | null; longitude?: number | null; notes?: string | null },
  ): Promise<SchedulePlanWithDetails> {
    return prisma.schedulePlan.update({ where: { planId }, data, include: detailInclude });
  },

  updateStatus(
    planId: string,
    status: ScheduleStatus,
    notes: string | null | undefined,
    evidenceIds: string[] | undefined,
  ): Promise<SchedulePlanWithDetails> {
    return prisma.schedulePlan.update({
      where: { planId },
      data: {
        status,
        ...(notes !== undefined ? { notes } : {}),
        ...(evidenceIds !== undefined
          ? {
              evidences: {
                deleteMany: {},
                create: evidenceIds.map((id) => ({ evidenceId: id })),
              },
            }
          : {}),
      },
      include: detailInclude,
    });
  },

  async updateStatusBatch(
    planIds: string[],
    status: ScheduleStatus,
    notes: string | null | undefined,
  ): Promise<SchedulePlanWithDetails[]> {
    await prisma.$transaction(
      planIds.map((planId) =>
        prisma.schedulePlan.update({
          where: { planId },
          data: { status, ...(notes !== undefined ? { notes } : {}) },
        }),
      ),
    );
    return prisma.schedulePlan.findMany({ where: { planId: { in: planIds } }, include: detailInclude });
  },

  addAssignee(planId: string, userId: string, role: PlanMemberRole) {
    return prisma.schedulePlanAssignee.create({ data: { planId, userId, role } });
  },

  removeAssignee(planId: string, userId: string) {
    return prisma.schedulePlanAssignee.delete({ where: { planId_userId: { planId, userId } } });
  },

  checkIn(assigneeId: string, checkInEvidenceId?: string, latitude?: number, longitude?: number) {
    return prisma.attendance.upsert({
      where: { assigneeId },
      create: { assigneeId, checkInAt: new Date(), checkInEvidenceId, latitude, longitude },
      update: { checkInAt: new Date(), checkInEvidenceId, latitude, longitude },
    });
  },

  checkOut(assigneeId: string, latitude?: number, longitude?: number) {
    return prisma.attendance.update({ where: { assigneeId }, data: { checkOutAt: new Date(), latitude, longitude } });
  },

  attachEvidence(planId: string, evidenceIds: string[]) {
    return prisma.schedulePlan.update({ 
      where: { planId }, 
      data: { 
        evidences: {
          deleteMany: {},
          create: evidenceIds.map((id) => ({ evidenceId: id })),
        } 
      } 
    });
  },

  async listWorkTasks(skip?: number, take?: number, search?: string) {
    const where: Prisma.WorkTaskWhereInput = { isActive: true };
    if (search) {
      where.OR = [
        { taskCode: { contains: search } },
        { taskName: { contains: search } },
      ];
    }

    const [rows, totalItems] = await Promise.all([
      prisma.workTask.findMany({ where, orderBy: { taskName: 'asc' }, skip, take }),
      prisma.workTask.count({ where }),
    ]);
    return { rows, totalItems };
  },

  getWorkTaskById(taskId: string) {
    return prisma.workTask.findUnique({ where: { taskId } });
  },

  getWorkTaskByCode(taskCode: string) {
    return prisma.workTask.findUnique({ where: { taskCode } });
  },

  createWorkTask(data: Prisma.WorkTaskUncheckedCreateInput) {
    return prisma.workTask.create({ data });
  },

  updateWorkTask(taskId: string, data: Prisma.WorkTaskUpdateInput) {
    return prisma.workTask.update({ where: { taskId }, data });
  },

  delete(planId: string) {
    return prisma.schedulePlan.delete({ where: { planId } });
  },

  async listAttendances(skip?: number, take?: number, orderId?: string, search?: string, taskId?: string) {
    const where: Prisma.SchedulePlanAssigneeWhereInput = {};
    
    const planConditions: Prisma.SchedulePlanWhereInput = {};
    if (orderId) planConditions.orderId = orderId;
    if (taskId) planConditions.taskId = taskId;
    if (Object.keys(planConditions).length > 0) {
      where.plan = planConditions;
    }

    if (search) {
      where.user = {
        OR: [
          { fullName: { contains: search } },
          { employeeCode: { contains: search } },
        ],
      };
    }

    const [rows, totalItems] = await Promise.all([
      prisma.schedulePlanAssignee.findMany({
        where,
        include: {
          attendance: true,
          user: true,
          plan: { include: { order: true, task: true } },
        },
        orderBy: { plan: { startTime: 'desc' } },
        skip,
        take,
      }),
      prisma.schedulePlanAssignee.count({ where }),
    ]);

    return { rows, totalItems };
  },

  // Tạo nhiều dòng schedule_plans cùng orderId trong 1 transaction (docs/api/kehoachvaphancong_api.md
  // mục 8.5 điểm 2) — mã planCode sinh tuần tự TRƯỚC khi vào transaction vì mỗi create() độc lập, không
  // đọc được kết quả của create() khác trong cùng mảng $transaction.
  async createBatch(
    orderId: string,
    createdBy: string,
    plans: {
      taskId: string;
      startTime: Date;
      endTime: Date | null;
      location: string | null;
      latitude: number | null;
      longitude: number | null;
      notes: string | null;
      assignees: { userId: string; role: PlanMemberRole }[];
    }[],
  ): Promise<SchedulePlanWithDetails[]> {
    const startCount = await prisma.schedulePlan.count();
    return prisma.$transaction(
      plans.map((plan, index) =>
        prisma.schedulePlan.create({
          data: {
            planCode: `PLN-${String(startCount + index + 1).padStart(3, '0')}`,
            orderId,
            taskId: plan.taskId,
            startTime: plan.startTime,
            endTime: plan.endTime,
            location: plan.location,
            latitude: plan.latitude,
            longitude: plan.longitude,
            notes: plan.notes,
            createdBy,
            assignees: { create: plan.assignees.map((a) => ({ userId: a.userId, role: a.role })) },
          },
          include: detailInclude,
        }),
      ),
    );
  },
  async syncOrderDates(orderId: string): Promise<void> {
    const plans = await prisma.schedulePlan.findMany({
      where: { orderId },
      select: { startTime: true, endTime: true }
    });
    if (plans.length > 0) {
      const maxDate = new Date(Math.max(...plans.map(p => p.endTime ? p.endTime.getTime() : p.startTime.getTime())));
      await prisma.order.update({
        where: { orderId },
        data: { endDate: maxDate }
      });
    }
  },
};
