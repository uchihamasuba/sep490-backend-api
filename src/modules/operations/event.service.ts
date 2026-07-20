import type { OrderStatus, PaymentStatus, PlanMemberRole, ScheduleStatus, SurveyStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { eventRepository, type OrderOverview } from './event.repository';
import { computeAggregateStatus, type AggregateScheduleStatus } from './schedule.service';

export interface EventScheduleItemDTO {
  planId: string;
  planCode: string;
  taskName: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  status: ScheduleStatus;
  assignees: {
    userId: string;
    fullName: string;
    role: PlanMemberRole;
    phone: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
  }[];
}

export interface EventSurveyItemDTO {
  surveyId: string;
  reportCode: string;
  surveyDate: string;
  status: SurveyStatus;
  reportedByName: string;
  confirmedByName: string | null;
}

export interface EventMilestoneDTO {
  key: string;
  label: string;
  completed: boolean;
}

export interface EventOverviewDTO {
  order: {
    orderId: string;
    orderCode: string;
    eventType: string;
    eventName: string | null;
    eventDate: string;
    location: string;
    guestCount: number | null;
    totalAmount: number;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    notes: string | null;
    createdBy: { userId: string; fullName: string };
  };
  customer: { customerId: string; customerName: string; phone: string; email: string; address: string | null };
  schedulePlans: EventScheduleItemDTO[];
  scheduleAggregateStatus: AggregateScheduleStatus | null;
  surveyReports: EventSurveyItemDTO[];
  milestones: EventMilestoneDTO[];
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function mapOverview(order: OrderOverview): EventOverviewDTO {
  const schedulePlans: EventScheduleItemDTO[] = order.schedulePlans.map((p) => ({
    planId: p.planId,
    planCode: p.planCode,
    taskName: p.task.taskName,
    startTime: p.startTime.toISOString(),
    endTime: p.endTime ? p.endTime.toISOString() : null,
    location: p.location,
    status: p.status,
    assignees: p.assignees.map((a) => ({
      userId: a.userId,
      fullName: a.user.fullName,
      role: a.role,
      phone: a.user.phone,
      checkInAt: a.attendance?.checkInAt ? a.attendance.checkInAt.toISOString() : null,
      checkOutAt: a.attendance?.checkOutAt ? a.attendance.checkOutAt.toISOString() : null,
    })),
  }));

  const surveyReports: EventSurveyItemDTO[] = order.surveyReports.map((s) => ({
    surveyId: s.surveyId,
    reportCode: s.reportCode,
    surveyDate: s.surveyDate.toISOString(),
    status: s.status,
    reportedByName: s.reporter.fullName,
    confirmedByName: s.confirmer?.fullName ?? null,
  }));

  const scheduleAggregateStatus = computeAggregateStatus(order.schedulePlans.map((p) => p.status));
  const surveyConfirmed = order.surveyReports.some((s) => s.status === 'CONFIRMED');

  // Chỉ tổng hợp các mốc tính được thật từ dữ liệu hiện có (order/schedule/survey) — KHÔNG bịa mốc
  // cọc/quyết toán (cần domain Deposit/Settlement, ngoài phạm vi cụm Operations lần này) hay mốc
  // checklist Live Show/đóng đơn (cần cột DB mới, chưa được duyệt migrate — xem
  // docs/api/tiendosukien_api.md mục 5/7).
  const milestones: EventMilestoneDTO[] = [
    { key: 'ORDER_CREATED', label: 'Khởi tạo đơn hàng', completed: true },
    { key: 'SURVEY_CONFIRMED', label: 'Khảo sát hiện trường đã xác nhận', completed: surveyConfirmed },
    {
      key: 'SCHEDULE_COMPLETED',
      label: 'Lập kế hoạch & thi công kỹ thuật',
      completed: scheduleAggregateStatus === 'COMPLETED',
    },
    { key: 'EVENT_COMPLETED', label: 'Sự kiện đã hoàn tất', completed: order.orderStatus === 'COMPLETED' },
  ];

  return {
    order: {
      orderId: order.orderId,
      orderCode: order.orderCode,
      eventType: order.eventType,
      eventName: order.eventName,
      eventDate: order.eventDate.toISOString(),
      location: order.location,
      guestCount: order.guestCount,
      totalAmount: toNumber(order.totalAmount),
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      notes: order.notes,
      createdBy: { userId: order.creator.userId, fullName: order.creator.fullName },
    },
    customer: {
      customerId: order.customer.customerId,
      customerName: order.customer.customerName,
      phone: order.customer.phone,
      email: order.customer.email ?? '',
      address: order.customer.address,
    },
    schedulePlans,
    scheduleAggregateStatus,
    surveyReports,
    milestones,
  };
}

async function getEventOverview(orderId: string): Promise<EventOverviewDTO> {
  const order = await eventRepository.findOrderOverview(orderId);
  if (!order) throw AppError.notFound('Order not found');
  return mapOverview(order);
}

export const eventService = {
  getEventOverview,
};
