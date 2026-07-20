import type { PlanMemberRole, Prisma, ScheduleStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface SchedulePlanListFilter {
  orderId?: string;
  status?: ScheduleStatus;
  taskId?: string;
  dateFrom?: Date;
  dateTo?: Date;
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
      location: true,
      customer: { select: { customerName: true } },
    },
  },
  task: { select: { taskId: true, taskName: true } },
  assignees: {
    include: {
      user: { select: { userId: true, fullName: true, role: true, phone: true } },
      attendance: true,
    },
  },
} satisfies Prisma.SchedulePlanInclude;

export type SchedulePlanWithDetails = Prisma.SchedulePlanGetPayload<{ include: typeof detailInclude }>;

function buildWhere(filter: SchedulePlanListFilter): Prisma.SchedulePlanWhereInput {
  const where: Prisma.SchedulePlanWhereInput = {};
  if (filter.orderId) where.orderId = filter.orderId;
  if (filter.status) where.status = filter.status;
  if (filter.taskId) where.taskId = filter.taskId;

  // Overlap giữa [startTime, endTime] của từng dòng và cửa sổ [dateFrom, dateTo] đang xem — phục vụ
  // tab "Lịch điều phối"/"Lịch timeline" (docs/api/kehoachvaphancong_api.md mục 3-4). Việc gộp theo
  // order_id + tính rangeStart=event_date/rangeEnd=MAX(end_time) là xử lý phía FE sau khi nhận dữ liệu
  // phẳng (docs/api/lichtimeline_api.md mục 3) — backend chỉ cần trả đủ các dòng giao với cửa sổ.
  const rangeConditions: Prisma.SchedulePlanWhereInput[] = [];
  if (filter.dateFrom) {
    rangeConditions.push({ OR: [{ endTime: null, startTime: { gte: filter.dateFrom } }, { endTime: { gte: filter.dateFrom } }] });
  }
  if (filter.dateTo) {
    rangeConditions.push({ startTime: { lte: filter.dateTo } });
  }
  if (rangeConditions.length > 0) where.AND = rangeConditions;

  return where;
}

export const scheduleRepository = {
  async findMany(params: SchedulePlanListParams) {
    const where = buildWhere(params);
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

  async create(params: {
    planCode: string;
    orderId: string;
    taskId: string;
    startTime: Date;
    endTime: Date | null;
    location: string | null;
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
        notes: params.notes,
        createdBy: params.createdBy,
        assignees: { create: params.assignees.map((a) => ({ userId: a.userId, role: a.role })) },
      },
      include: detailInclude,
    });
  },

  update(
    planId: string,
    data: { startTime?: Date; endTime?: Date | null; location?: string | null; notes?: string | null },
  ): Promise<SchedulePlanWithDetails> {
    return prisma.schedulePlan.update({ where: { planId }, data, include: detailInclude });
  },

  updateStatus(
    planId: string,
    status: ScheduleStatus,
    notes: string | null | undefined,
    evidenceId: string | null | undefined,
  ): Promise<SchedulePlanWithDetails> {
    return prisma.schedulePlan.update({
      where: { planId },
      data: {
        status,
        ...(notes !== undefined ? { notes } : {}),
        ...(evidenceId !== undefined ? { evidenceId } : {}),
      },
      include: detailInclude,
    });
  },

  findAssignee(planId: string, userId: string) {
    return prisma.schedulePlanAssignee.findUnique({
      where: { planId_userId: { planId, userId } },
      include: { attendance: true },
    });
  },

  addAssignee(planId: string, userId: string, role: PlanMemberRole) {
    return prisma.schedulePlanAssignee.create({ data: { planId, userId, role } });
  },

  removeAssignee(planId: string, userId: string) {
    return prisma.schedulePlanAssignee.delete({ where: { planId_userId: { planId, userId } } });
  },

  checkIn(assigneeId: string) {
    return prisma.attendance.upsert({
      where: { assigneeId },
      create: { assigneeId, checkInAt: new Date() },
      update: { checkInAt: new Date() },
    });
  },

  checkOut(assigneeId: string) {
    return prisma.attendance.update({ where: { assigneeId }, data: { checkOutAt: new Date() } });
  },

  listWorkTasks() {
    return prisma.workTask.findMany({ where: { isActive: true }, orderBy: { taskName: 'asc' } });
  },
};
