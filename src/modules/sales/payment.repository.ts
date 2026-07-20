import type { Deposit, DepositStatus, Settlement } from '@prisma/client';
import { prisma } from '../../db/prisma';

export const paymentRepository = {
  findDepositById(depositId: string): Promise<Deposit | null> {
    return prisma.deposit.findUnique({ where: { depositId } });
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
