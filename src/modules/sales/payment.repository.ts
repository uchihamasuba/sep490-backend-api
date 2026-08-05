import type { Deposit, DepositStatus, Prisma } from '@prisma/client';
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
  evidences: { select: { evidenceId: true } },
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
  findDepositById(depositId: string) {
    return prisma.deposit.findUnique({ where: { depositId }, include: { evidences: { select: { evidenceId: true } } } });
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

  // Khi status -> PAID: set approvedBy/approvedAt/paymentDate VÀ cập nhật orders.payment_status =
  // DEPOSITED trong CÙNG 1 transaction — khớp đúng hành vi đã chốt ở docs/api/tiendosukien_api.md mục
  // 3.1 (FE không cần tự gọi thêm PUT /orders/:id/status sau khi xác nhận cọc).
  async updateStatus(
    depositId: string,
    orderId: string,
    status: DepositStatus,
    approvedBy: string,
    evidenceIds?: string[]
  ) {
    const evidencesUpdate = evidenceIds !== undefined ? {
      evidences: {
        deleteMany: {},
        create: evidenceIds.map((id) => ({ evidenceId: id })),
      }
    } : {};

    if (status !== 'PAID') {
      return prisma.deposit.update({ where: { depositId }, data: { status, ...evidencesUpdate } });
    }

    const now = new Date();
    const [deposit] = await prisma.$transaction([
      prisma.deposit.update({ where: { depositId }, data: { status, approvedBy, approvedAt: now, paymentDate: now, ...evidencesUpdate } }),
      prisma.order.update({ where: { orderId }, data: { paymentStatus: 'DEPOSITED' } }),
    ]);

    return deposit;
  },

  findSettlementById(settlementId: string) {
    return prisma.settlement.findUnique({ where: { settlementId }, include: { evidences: { select: { evidenceId: true } } } });
  },

  async confirmSettlement(settlementId: string, orderId: string, confirmedBy: string, evidenceIds?: string[]) {
    const evidencesUpdate = evidenceIds !== undefined ? {
      evidences: {
        deleteMany: {},
        create: evidenceIds.map((id) => ({ evidenceId: id })),
      }
    } : {};

    const [settlement] = await prisma.$transaction([
      prisma.settlement.update({
        where: { settlementId },
        data: { status: 'PAID', confirmedBy, confirmedAt: new Date(), ...evidencesUpdate },
      }),
      prisma.order.update({
        where: { orderId },
        data: { paymentStatus: 'PAID' }
      })
    ]);
    return settlement;
  },

  async markSettlementPaid(settlementId: string, evidenceIds: string[], orderId: string) {
    const [settlement] = await prisma.$transaction([
      prisma.settlement.update({
        where: { settlementId },
        data: { 
          status: 'PAID', 
          paidAt: new Date(), 
          evidences: {
            deleteMany: {},
            create: evidenceIds.map((id) => ({ evidenceId: id })),
          }
        },
      }),
      prisma.order.update({
        where: { orderId },
        data: { paymentStatus: 'PAID' }
      })
    ]);
    return settlement;
  },
};
