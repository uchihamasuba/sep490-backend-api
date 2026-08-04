
import { scheduleRepository } from '../schedule.repository';
import { prisma } from '../../../db/prisma';

jest.mock('../../../db/prisma', () => ({
  prisma: {
    schedulePlan: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    workTask: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    schedulePlanAssignee: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

describe('scheduleRepository.syncOrderDates', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should only update endDate and not overwrite eventDate', async () => {
    const mockOrderId = 'mock-order-id';
    
    // Mock 2 plans: one before the event (survey), one after (collection)
    const mockPlans = [
      { startTime: new Date('2026-08-07T08:00:00Z'), endTime: new Date('2026-08-07T12:00:00Z') },
      { startTime: new Date('2026-09-02T08:00:00Z'), endTime: new Date('2026-09-02T12:00:00Z') },
    ];
    
    (prisma.schedulePlan.findMany as jest.Mock).mockResolvedValue(mockPlans);
    
    await scheduleRepository.syncOrderDates(mockOrderId);
    
    expect(prisma.schedulePlan.findMany).toHaveBeenCalledWith({
      where: { orderId: mockOrderId },
      select: { startTime: true, endTime: true },
    });
    
    expect(prisma.order.update).toHaveBeenCalledTimes(1);
    
    // Validate the exact payload passed to prisma.order.update
    const updateCallArgs = (prisma.order.update as jest.Mock).mock.calls[0][0];
    
    expect(updateCallArgs).toEqual({
      where: { orderId: mockOrderId },
      data: { endDate: new Date('2026-09-02T12:00:00Z') },
    });
    
    // Explicitly assert that eventDate is undefined in the update data
    expect(updateCallArgs.data.eventDate).toBeUndefined();
  });
  
  it('should not call prisma.order.update if there are no plans', async () => {
    const mockOrderId = 'mock-order-id';
    
    (prisma.schedulePlan.findMany as jest.Mock).mockResolvedValue([]);
    
    await scheduleRepository.syncOrderDates(mockOrderId);
    
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
