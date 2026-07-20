import type { ActiveStatus, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface CustomerListFilter {
  status?: ActiveStatus;
  search?: string;
}

export interface CustomerListParams extends CustomerListFilter {
  skip: number;
  take: number;
}

export interface CustomerOrderListFilter {
  search?: string;
  status?: OrderStatus;
  serviceFilter?: string;
}

function buildCustomerWhere(filter: CustomerListFilter): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    const q = filter.search;
    where.OR = [
      { customerId: { contains: q } },
      { customerName: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ];
  }
  return where;
}

function buildOrderWhere(customerId: string, filter: CustomerOrderListFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { customerId };
  if (filter.status) where.orderStatus = filter.status;
  if (filter.serviceFilter && filter.serviceFilter !== 'all') {
    where.eventType = { contains: filter.serviceFilter };
  }
  if (filter.search) {
    const q = filter.search;
    where.AND = [
      {
        OR: [{ orderCode: { contains: q } }, { eventName: { contains: q } }, { eventType: { contains: q } }],
      },
    ];
  }
  return where;
}

export const customerRepository = {
  async findMany(params: CustomerListParams) {
    const where = buildCustomerWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.customer.findMany({ where, skip: params.skip, take: params.take, orderBy: { createdAt: 'desc' } }),
      prisma.customer.count({ where }),
    ]);
    return { rows, totalItems };
  },

  async countByStatus(search?: string) {
    const where = buildCustomerWhere({ search });
    const [all, active, inactive] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.count({ where: { ...where, status: 'ACTIVE' } }),
      prisma.customer.count({ where: { ...where, status: 'INACTIVE' } }),
    ]);
    return { all, active, inactive };
  },

  async getOrderStatsByCustomerIds(customerIds: string[]) {
    if (customerIds.length === 0) return [];
    return prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
  },

  async getOrderStatsForCustomer(customerId: string) {
    const result = await prisma.order.aggregate({
      where: { customerId },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    return { totalBookings: result._count._all, totalSpent: result._sum.totalAmount };
  },

  findById(customerId: string) {
    return prisma.customer.findUnique({ where: { customerId } });
  },

  // Không có UNIQUE INDEX thật trên cột phone ở DB hiện tại (docs/api/taokhachhang_api.md mục 3) —
  // service dùng hàm này để tự kiểm tra trùng trước khi insert (chưa chặn được race condition ở tầng DB).
  findByPhone(phone: string) {
    return prisma.customer.findFirst({ where: { phone } });
  },

  create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({ data });
  },

  update(customerId: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { customerId }, data });
  },

  delete(customerId: string) {
    return prisma.customer.delete({ where: { customerId } });
  },

  countOrders(customerId: string) {
    return prisma.order.count({ where: { customerId } });
  },

  countActiveOrders(customerId: string) {
    return prisma.order.count({ where: { customerId, orderStatus: { in: ['NEW', 'IN_PROGRESS'] } } });
  },

  async getOrderIdsForCustomer(customerId: string) {
    const orders = await prisma.order.findMany({ where: { customerId }, select: { orderId: true } });
    return orders.map((o) => o.orderId);
  },

  sumSuccessfulDeposits(orderIds: string[]) {
    if (orderIds.length === 0) return Promise.resolve<{ _sum: { amount: Prisma.Decimal | null } }>({ _sum: { amount: null } });
    return prisma.deposit.aggregate({ where: { orderId: { in: orderIds }, status: 'SUCCESS' }, _sum: { amount: true } });
  },

  sumSettledAmounts(orderIds: string[]) {
    if (orderIds.length === 0)
      return Promise.resolve<{ _sum: { finalAmount: Prisma.Decimal | null } }>({ _sum: { finalAmount: null } });
    return prisma.settlement.aggregate({
      where: { orderId: { in: orderIds }, status: { in: ['PAID', 'CONFIRMED'] } },
      _sum: { finalAmount: true },
    });
  },

  async listOrders(customerId: string, filter: CustomerOrderListFilter, skip: number, take: number) {
    const where = buildOrderWhere(customerId, filter);
    const [rows, totalItems] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { eventDate: 'desc' },
        include: { creator: { select: { fullName: true } } },
      }),
      prisma.order.count({ where }),
    ]);
    return { rows, totalItems };
  },
};
