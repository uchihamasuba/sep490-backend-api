import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { orderService } from '../../sales/order.service';
import { inventoryService } from '../../inventory/inventory.service';

jest.mock('../../sales/order.service', () => ({
  orderService: { getOrderById: jest.fn() },
}));

jest.mock('../../inventory/inventory.service', () => ({
  inventoryService: { createReport: jest.fn() },
}));

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedInventoryService = inventoryService as jest.Mocked<typeof inventoryService>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'LEADER', id = 'leader-1') {
  const token = jwt.sign({ id, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

describe('GET /api/v1/mobile/orders/:id', () => {
  it('returns the order detail', async () => {
    mockedOrderService.getOrderById.mockResolvedValue({ orderId: 'order-1', orderCode: 'ORD-001' } as never);

    const res = await request(app).get('/api/v1/mobile/orders/order-1').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ orderId: 'order-1', orderCode: 'ORD-001' });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/mobile/orders/order-1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/mobile/orders/:id/collected-reports', () => {
  it('submits a report using the authenticated Leader as reportedBy, defaulting reportType to INTERNAL', async () => {
    mockedInventoryService.createReport.mockResolvedValue({ reportId: 'report-1', status: 'SUBMITTED' } as never);

    const res = await request(app)
      .post('/api/v1/mobile/orders/order-1/collected-reports')
      .set('Authorization', authHeader('LEADER', 'leader-1'))
      .send({ items: [{ itemId: 'item-1', goodQuantity: 2, damagedQuantity: 0, lostQuantity: 0 }] });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ reportId: 'report-1', status: 'SUBMITTED' });
    expect(mockedInventoryService.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', reportType: 'INTERNAL' }),
      'leader-1',
    );
  });

  it('rejects a payload with no items with 400', async () => {
    const res = await request(app)
      .post('/api/v1/mobile/orders/order-1/collected-reports')
      .set('Authorization', authHeader())
      .send({ items: [] });
    expect(res.status).toBe(400);
    expect(mockedInventoryService.createReport).not.toHaveBeenCalled();
  });

  it('is forbidden for non-Leader roles', async () => {
    const res = await request(app)
      .post('/api/v1/mobile/orders/order-1/collected-reports')
      .set('Authorization', authHeader('TECHNICAL'))
      .send({ items: [{ itemId: 'item-1', goodQuantity: 1 }] });
    expect(res.status).toBe(403);
  });
});
