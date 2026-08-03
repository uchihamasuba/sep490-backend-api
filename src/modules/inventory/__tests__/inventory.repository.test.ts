import { inventoryRepository } from '../inventory.repository';

jest.mock('../../../db/prisma', () => {
  const mPrisma = {
    order: { findMany: jest.fn() },
    supplierTransactionItem: { findMany: jest.fn() },
  };
  return { prisma: mPrisma };
});

import { prisma } from '../../../db/prisma';

describe('inventoryRepository.getLockedQuantityByDate', () => {
  const mockedPrisma = prisma as unknown as {
    order: { findMany: jest.Mock };
    supplierTransactionItem: { findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters schedulePlans correctly based on confirmedAt threshold', async () => {
    // Setup mock data
    const mockOrderDate = new Date('2026-08-01T10:00:00.000Z');
    const confirmedAt = new Date('2026-08-03T10:00:00.000Z');
    const validPlanStartTime = new Date('2026-08-04T10:00:00.000Z'); // After confirmedAt
    const invalidPlanStartTime = new Date('2026-08-02T10:00:00.000Z'); // Before confirmedAt

    mockedPrisma.order.findMany.mockResolvedValue([
      {
        orderId: 'ord-1',
        eventDate: mockOrderDate,
        endDate: null,
        createdAt: mockOrderDate,
        confirmedAt,
        orderItems: [{ quantity: 5 }],
        schedulePlans: [
          { startTime: invalidPlanStartTime, endTime: null },
          { startTime: validPlanStartTime, endTime: null },
        ],
      },
    ]);

    mockedPrisma.supplierTransactionItem.findMany.mockResolvedValue([]);

    // Query for 2026-08-04
    const queryDate = new Date('2026-08-04T00:00:00.000Z');
    const lockedQty = await inventoryRepository.getLockedQuantityByDate('item-1', queryDate);

    expect(mockedPrisma.order.findMany).toHaveBeenCalledTimes(1);
    expect(lockedQty).toBe(5);
  });
});
