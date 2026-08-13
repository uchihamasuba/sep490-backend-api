import { prisma } from '../../db/prisma';

export const reportRepository = {
  async getCommittedOrders(start: Date, end: Date) {
    return prisma.order.findMany({
      where: {
        orderStatus: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
        eventDate: { gte: start, lte: end }
      },
      select: {
        orderId: true,
        eventDate: true,
        totalAmount: true,
        orderStatus: true,
        eventType: true,
        customer: { select: { customerName: true } }
      }
    });
  },

  async getRelatedSupplierTransactions(orderIds: string[]) {
    if (orderIds.length === 0) return [];
    return prisma.supplierTransaction.findMany({
      where: {
        orderId: { in: orderIds },
        status: { not: 'CANCELLED' }
      },
      select: { orderId: true, estimatedCost: true }
    });
  },

  async getRelatedDeposits(orderIds: string[]) {
    if (orderIds.length === 0) return [];
    return prisma.deposit.findMany({
      where: { orderId: { in: orderIds }, status: 'PAID' },
      select: { orderId: true, amount: true }
    });
  },

  async getRelatedSettlements(orderIds: string[]) {
    if (orderIds.length === 0) return [];
    return prisma.settlement.findMany({
      where: { orderId: { in: orderIds }, status: 'PAID' },
      select: { orderId: true, finalAmount: true }
    });
  },

  async getPaidDepositsInPeriod(start: Date, end: Date) {
    return prisma.deposit.findMany({
      where: {
        status: 'PAID',
        paymentDate: { gte: start, lte: end }
      },
      select: { paymentDate: true, amount: true }
    });
  },

  async getPaidSettlementsInPeriod(start: Date, end: Date) {
    return prisma.settlement.findMany({
      where: {
        status: 'PAID',
        paidAt: { gte: start, lte: end }
      },
      select: { paidAt: true, finalAmount: true }
    });
  },

  async getSupplierTransactionsInPeriod(start: Date, end: Date) {
    return prisma.supplierTransaction.findMany({
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: start, lte: end }
      },
      select: { createdAt: true, estimatedCost: true }
    });
  },

  async getCompletedOrders() {
    return prisma.order.findMany({
      where: { orderStatus: 'COMPLETED' },
      select: { orderId: true, totalAmount: true }
    });
  }
};
