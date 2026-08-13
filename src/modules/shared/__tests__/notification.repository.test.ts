import { notificationRepository } from '../notification.repository';
import { prisma } from '../../../db/prisma';

jest.mock('../../../db/prisma', () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('notificationRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createNotification', async () => {
    (prisma.notification.create as jest.Mock).mockResolvedValue({ notificationId: 'n1' });
    const data = { userId: 'u1', title: 'Test', content: 'test content' };
    await notificationRepository.createNotification(data);
    expect(prisma.notification.create).toHaveBeenCalledWith({ data });
  });

  it('getUserDeviceToken', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ deviceToken: 'token' });
    await notificationRepository.getUserDeviceToken('u1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' }, select: { deviceToken: true } });
  });

  it('findNotificationsByUserId', async () => {
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([{ notificationId: 'n1' }]);
    (prisma.notification.count as jest.Mock).mockResolvedValue(1);
    
    const result = await notificationRepository.findNotificationsByUserId('u1', 0, 10);
    
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1' },
      skip: 0,
      take: 10,
    }));
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(result).toEqual({ rows: [{ notificationId: 'n1' }], totalItems: 1 });
  });

  it('findById', async () => {
    (prisma.notification.findUnique as jest.Mock).mockResolvedValue({ notificationId: 'n1' });
    await notificationRepository.findById('n1');
    expect(prisma.notification.findUnique).toHaveBeenCalledWith({ where: { notificationId: 'n1' } });
  });

  it('markNotificationAsRead', async () => {
    (prisma.notification.update as jest.Mock).mockResolvedValue({});
    await notificationRepository.markNotificationAsRead('n1');
    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { notificationId: 'n1' },
      data: expect.objectContaining({ isRead: true }),
    }));
  });

  it('updateUserDeviceToken', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    await notificationRepository.updateUserDeviceToken('u1', 'new-token');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { deviceToken: 'new-token' },
      select: { userId: true, deviceToken: true },
    });
  });
});
