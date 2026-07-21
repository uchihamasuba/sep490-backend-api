import type { Deposit, DepositStatus, Prisma, Settlement } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface DepositListFilter {
  status?: DepositStatus;
  search?: string;
}

export interface DepositListParams extends DepositListFilter {
  skip: number;
  take: number;
}

const depositListInclude = {
  order: {
    select: {
      orderCode: true,
      eventName: true,
      eventType: true,
      customer: { select: { customerName: true, phone: true } },
    },
  },
} satisfies Prisma.DepositInclude;

export type DepositWithOrder = Prisma.DepositGetPayload<{ include: typeof depositListInclude }>;

function buildDepositWhere(filter: DepositListFilter): Prisma.DepositWhereInput {
  const where: Prisma.DepositWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    const q = filter.search;
    where.OR = [
      { depositCode: { contains: q } },
      { order: { orderCode: { contains: q } } },
      { order: { customer: { customerName: { contains: q } } } },
      { order: { customer: { phone: { contains: q } } } },
    ];
  }
  return where;
}

export const paymentRepository = {
  findDepositById(depositId: string): Promise<Deposit | null> {
    return prisma.deposit.findUnique({ where: { depositId } });
  },

  async findManyDeposits(params: DepositListParams) {
    const where = buildDepositWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.deposit.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: depositListInclude,
      }),
      prisma.deposit.count({ where }),
    ]);
    return { rows, totalItems };
  },

  deleteDeposit(depositId: string): Promise<Deposit> {
    return prisma.deposit.delete({ where: { depositId } });
  },

  // Khi status -> SUCCESS: set approvedBy/approvedAt/paymentDate VÀ cập nhật orders.payment_status =
  // DEPOSITED trong CÙNG 1 transaction — khớp đúng hành vi đã chốt ở docs/api/tiendosukien_api.md mục
  // 3.1 (FE không cần tự gọi thêm PUT /orders/:id/status sau khi xác nhận cọc).
  async updateStatus(
    depositId: string,
    orderId: string,
    status: DepositStatus,
    approvedBy: string,
  ): Promise<Deposit> {
    if (status !== 'SUCCESS') {
      return prisma.deposit.update({ where: { depositId }, data: { status } });
    }

    const now = new Date();
    const [deposit] = await prisma.$transaction([
      prisma.deposit.update({ where: { depositId }, data: { status, approvedBy, approvedAt: now, paymentDate: now } }),
      prisma.order.update({ where: { orderId }, data: { paymentStatus: 'DEPOSITED' } }),
    ]);

    return deposit;
  },

  findSettlementById(settlementId: string): Promise<Settlement | null> {
    return prisma.settlement.findUnique({ where: { settlementId } });
  },

  confirmSettlement(settlementId: string, confirmedBy: string): Promise<Settlement> {
    return prisma.settlement.update({
      where: { settlementId },
      data: { status: 'CONFIRMED', confirmedBy, confirmedAt: new Date() },
    });
  },
};
