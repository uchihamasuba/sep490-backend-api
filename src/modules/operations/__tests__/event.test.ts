import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { eventRepository } from '../event.repository';
import { eventService } from '../event.service';

jest.mock('../event.repository', () => ({
  eventRepository: {
    findOrderOverview: jest.fn(),
  },
}));

const mockedRepo = eventRepository as jest.Mocked<typeof eventRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeOrderOverview(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'ord-1',
    orderCode: 'ORD-001',
    eventType: 'Conference',
    eventName: 'Tech Summit 2026',
    eventDate: new Date('2026-08-15T02:00:00Z'),
    location: '123 Tech St. Hall A',
    guestCount: 500,
    totalAmount: 1600000,
    orderStatus: 'CONFIRMED',
    paymentStatus: 'UNPAID',
    notes: null,
    customer: {
      customerId: 'cus-1',
      customerName: 'Nguyen Minh Tri',
      phone: '0910000000',
      email: 'tri.nm@gmail.com',
      address: '123 Nguyen Hue',
    },
    creator: { userId: 'mgr-1', fullName: 'Project Manager' },
    schedulePlans: [
      {
        planId: 'plan-1',
        planCode: 'PLN-001',
        task: { taskName: 'Lắp đặt thiết bị' },
        startTime: new Date('2026-08-14T07:00:00Z'),
        endTime: new Date('2026-08-14T11:00:00Z'),
        location: '123 Tech St. Hall A',
        status: 'IN_PROGRESS',
        assignees: [
          {
            userId: 'leader-1',
            role: 'LEAD',
            user: { userId: 'leader-1', fullName: 'Le Van Leader', phone: '0900000003' },
            attendance: { checkInAt: new Date('2026-08-14T07:05:00Z'), checkOutAt: null },
          },
        ],
      },
    ],
    surveyReports: [
      {
        surveyId: 'sur-1',
        reportCode: 'SUR-001',
        surveyDate: new Date('2026-07-25T02:00:00Z'),
        status: 'CONFIRMED',
        reporter: { userId: 'leader-1', fullName: 'Le Van Leader' },
        confirmer: { userId: 'mgr-1', fullName: 'Project Manager' },
      },
    ],
    ...overrides,
  };
}

describe('eventService.getEventOverview', () => {
  it('throws 404 when the order does not exist', async () => {
    mockedRepo.findOrderOverview.mockResolvedValue(null);
    await expect(eventService.getEventOverview('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('computes milestones and aggregate schedule status honestly from available data', async () => {
    mockedRepo.findOrderOverview.mockResolvedValue(fakeOrderOverview() as never);

    const result = await eventService.getEventOverview('ord-1');

    expect(result.order).toMatchObject({ orderId: 'ord-1', orderCode: 'ORD-001', totalAmount: 1600000 });
    expect(result.scheduleAggregateStatus).toBe('IN_PROGRESS');
    expect(result.milestones).toEqual([
      { key: 'ORDER_CREATED', label: 'Khởi tạo đơn hàng', completed: true },
      { key: 'SURVEY_CONFIRMED', label: 'Khảo sát hiện trường đã xác nhận', completed: true },
      { key: 'SCHEDULE_COMPLETED', label: 'Lập kế hoạch & thi công kỹ thuật', completed: false },
      { key: 'EVENT_COMPLETED', label: 'Sự kiện đã hoàn tất', completed: false },
    ]);
    expect(result.schedulePlans[0]).toMatchObject({
      planId: 'plan-1',
      taskName: 'Lắp đặt thiết bị',
      assignees: [expect.objectContaining({ fullName: 'Le Van Leader', checkInAt: expect.any(String), checkOutAt: null })],
    });
  });

  it('marks SCHEDULE_COMPLETED and EVENT_COMPLETED true when everything has wrapped up', async () => {
    mockedRepo.findOrderOverview.mockResolvedValue(
      fakeOrderOverview({
        orderStatus: 'COMPLETED',
        schedulePlans: [
          {
            planId: 'plan-1',
            planCode: 'PLN-001',
            task: { taskName: 'Lắp đặt thiết bị' },
            startTime: new Date('2026-08-14T07:00:00Z'),
            endTime: new Date('2026-08-14T11:00:00Z'),
            location: '123 Tech St. Hall A',
            status: 'COMPLETED',
            assignees: [],
          },
        ],
      }) as never,
    );

    const result = await eventService.getEventOverview('ord-1');
    expect(result.scheduleAggregateStatus).toBe('COMPLETED');
    expect(result.milestones.find((m) => m.key === 'SCHEDULE_COMPLETED')?.completed).toBe(true);
    expect(result.milestones.find((m) => m.key === 'EVENT_COMPLETED')?.completed).toBe(true);
  });
});

describe('HTTP routes — role permission matrix', () => {
  it('GET /api/v1/events/:orderId/overview succeeds for MANAGER', async () => {
    mockedRepo.findOrderOverview.mockResolvedValue(fakeOrderOverview() as never);

    const res = await request(app).get('/api/v1/events/ord-1/overview').set('Authorization', authHeader('MANAGER'));
    expect(res.status).toBe(200);
    expect(res.body.data.order.orderCode).toBe('ORD-001');
  });

  it('GET /api/v1/events/:orderId/overview succeeds for ADMIN (audit read-only)', async () => {
    mockedRepo.findOrderOverview.mockResolvedValue(fakeOrderOverview() as never);

    const res = await request(app).get('/api/v1/events/ord-1/overview').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/events/:orderId/overview is forbidden for LEADER', async () => {
    const res = await request(app).get('/api/v1/events/ord-1/overview').set('Authorization', authHeader('LEADER'));
    expect(res.status).toBe(403);
  });

  it('GET /api/v1/events/:orderId/overview is forbidden for TECHNICAL', async () => {
    const res = await request(app).get('/api/v1/events/ord-1/overview').set('Authorization', authHeader('TECHNICAL'));
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown order', async () => {
    mockedRepo.findOrderOverview.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/events/missing/overview').set('Authorization', authHeader('MANAGER'));
    expect(res.status).toBe(404);
  });
});
