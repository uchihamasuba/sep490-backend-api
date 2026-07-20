import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { orderPicklistRepository, orderRepository } from '../order.repository';

jest.mock('../order.repository', () => {
  const actual = jest.requireActual('../order.repository');
  return {
    ...actual,
    orderRepository: {
      ...actual.orderRepository,
      findById: jest.fn(),
      markPickedUp: jest.fn(),
    },
    orderPicklistRepository: {
      findMany: jest.fn(),
      findAllForCounts: jest.fn(),
      findLeadCoordinatorsByOrderIds: jest.fn(),
    },
  };
});

const mockedOrderRepo = orderRepository as jest.Mocked<typeof orderRepository>;
const mockedPicklistRepo = orderPicklistRepository as jest.Mocked<typeof orderPicklistRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakePicklistOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'order-1',
    orderCode: 'ORD-001',
    orderStatus: 'CONFIRMED',
    customer: { customerName: 'Nguyen Van A' },
    eventDate: new Date('2026-08-15T02:00:00.000Z'),
    orderItems: [{ quantity: 2, preparedQty: 2 }],
    pickedUpAt: null,
    pickedUpByUser: null,
    ...overrides,
  };
}

describe('GET /api/v1/orders/picklists', () => {
  it('returns picklist rows joined with coordinatorName + counts computed over the full filtered set', async () => {
    mockedPicklistRepo.findMany.mockResolvedValue({ rows: [fakePicklistOrder()], totalItems: 1 } as never);
    mockedPicklistRepo.findAllForCounts.mockResolvedValue([
      { orderId: 'order-1', pickedUpAt: null, orderItems: [{ quantity: 2, preparedQty: 2 }] },
      { orderId: 'order-2', pickedUpAt: new Date(), orderItems: [{ quantity: 1, preparedQty: 0 }] },
    ] as never);
    mockedPicklistRepo.findLeadCoordinatorsByOrderIds.mockResolvedValue(new Map([['order-1', 'Vu Hoang Long']]));

    const res = await request(app).get('/api/v1/orders/picklists').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      orderId: 'order-1',
      orderCode: 'ORD-001',
      customerName: 'Nguyen Van A',
      coordinatorName: 'Vu Hoang Long',
      totalItemsCount: 2,
      preparedItemsCount: 2,
      pickedUpAt: null,
    });
    expect(res.body.meta).toEqual({ page: 1, limit: 20, totalCount: 2, readyCount: 1, exportedCount: 1 });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/orders/picklists');
    expect(res.status).toBe(401);
  });

  it('is forbidden for non-Manager roles (no Admin mirror for this page)', async () => {
    const res = await request(app).get('/api/v1/orders/picklists').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/orders/:orderId/picklist/picked-up', () => {
  it('marks the order picked up when fully prepared and returns the mapped picklist item', async () => {
    mockedOrderRepo.findById.mockResolvedValue(fakePicklistOrder() as never);
    mockedOrderRepo.markPickedUp.mockResolvedValue(
      fakePicklistOrder({ pickedUpAt: new Date('2026-08-01T00:00:00Z'), pickedUpByUser: { fullName: 'Manager One' } }) as never,
    );
    mockedPicklistRepo.findLeadCoordinatorsByOrderIds.mockResolvedValue(new Map());

    const res = await request(app).put('/api/v1/orders/order-1/picklist/picked-up').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.pickedUpByName).toBe('Manager One');
    expect(mockedOrderRepo.markPickedUp).toHaveBeenCalledWith('order-1', 'user-1');
  });

  it('returns 400 when order_items are not fully prepared yet', async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      fakePicklistOrder({ orderItems: [{ quantity: 2, preparedQty: 1 }] }) as never,
    );

    const res = await request(app).put('/api/v1/orders/order-1/picklist/picked-up').set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(mockedOrderRepo.markPickedUp).not.toHaveBeenCalled();
  });

  it('returns 409 when the order is already picked up', async () => {
    mockedOrderRepo.findById.mockResolvedValue(fakePicklistOrder({ pickedUpAt: new Date() }) as never);

    const res = await request(app).put('/api/v1/orders/order-1/picklist/picked-up').set('Authorization', authHeader());

    expect(res.status).toBe(409);
  });

  it('returns 409 when the order status is not CONFIRMED/IN_PROGRESS', async () => {
    mockedOrderRepo.findById.mockResolvedValue(fakePicklistOrder({ orderStatus: 'NEW' }) as never);

    const res = await request(app).put('/api/v1/orders/order-1/picklist/picked-up').set('Authorization', authHeader());

    expect(res.status).toBe(409);
  });

  it('is forbidden for non-Manager roles', async () => {
    const res = await request(app).put('/api/v1/orders/order-1/picklist/picked-up').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(403);
  });
});
