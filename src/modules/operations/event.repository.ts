import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

const overviewInclude = {
  customer: {
    select: { customerId: true, customerName: true, phone: true, email: true, address: true },
  },
  creator: { select: { userId: true, fullName: true } },
  schedulePlans: {
    orderBy: { startTime: 'asc' },
    include: {
      task: { select: { taskName: true } },
      assignees: {
        include: {
          user: { select: { userId: true, fullName: true, role: true, phone: true } },
          attendance: true,
        },
      },
    },
  },
  surveyReports: {
    orderBy: { surveyDate: 'desc' },
    include: {
      reporter: { select: { userId: true, fullName: true } },
      confirmer: { select: { userId: true, fullName: true } },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderOverview = Prisma.OrderGetPayload<{ include: typeof overviewInclude }>;

export const eventRepository = {
  // 1 query duy nhất, tận dụng thẳng quan hệ Prisma đã có (Order.schedulePlans, Order.surveyReports) —
  // thay cho việc tab "Tổng quan sự kiện" phải gọi 3-4 endpoint riêng như các doc gốc mô tả
  // (docs/api/tongquansukien_api.md mục 2, docs/api/tiendosukien_api.md mục 2).
  findOrderOverview(orderId: string): Promise<OrderOverview | null> {
    return prisma.order.findUnique({ where: { orderId }, include: overviewInclude });
  },
};
