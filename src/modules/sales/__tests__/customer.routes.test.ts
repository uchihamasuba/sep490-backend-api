import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { ActiveStatus } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { customerRepository } from '../customer.repository';

jest.mock('../customer.repository', () => ({
  customerRepository: {
    findMany: jest.fn(),
    countByStatus: jest.fn(),
    getOrderStatsByCustomerIds: jest.fn(),
    getOrderStatsForCustomer: jest.fn(),
    findById: jest.fn(),
    findByPhone: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countOrders: jest.fn(),
    countActiveOrders: jest.fn(),
    getOrderIdsForCustomer: jest.fn(),
    sumSuccessfulDeposits: jest.fn(),
    sumSettledAmounts: jest.fn(),
    listOrders: jest.fn(),
  },
}));

const mockedRepo = customerRepository as jest.Mocked<typeof customerRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

interface FakeCustomer {
  customerId: string;
  customerCode: string;
  customerName: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: ActiveStatus;
  createdAt: Date;
  updatedAt: Date;
}

function baseCustomer(overrides: Partial<FakeCustomer> = {}): FakeCustomer {
  return {
    customerId: 'c1',
    customerCode: 'c1',
    customerName: 'Nguyen Van A',
    phone: '0910000000',
    email: null,
    address: null,
    notes: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/v1/customers', () => {
  it('returns a paginated list with tab counts in meta', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [baseCustomer()], totalItems: 46 });
    mockedRepo.countByStatus.mockResolvedValue({ all: 46, active: 40, inactive: 6 });
    mockedRepo.getOrderStatsByCustomerIds.mockResolvedValue([
      { customerId: 'c1', _count: { _all: 1 }, _sum: { totalAmount: 15000000 } },
    ] as never);

    const res = await request(app).get('/api/v1/customers').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ customerId: 'c1', status: 'active', email: '', totalBookings: 1, totalSpent: 15000000 });
    expect(res.body.meta).toEqual({ page: 1, limit: 10, totalItems: 46, totalPages: 5, counts: { all: 46, active: 40, inactive: 6 } });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/customers');
    expect(res.status).toBe(401);
  });

  it('rejects roles outside manager/admin with 403', async () => {
    const res = await request(app).get('/api/v1/customers').set('Authorization', authHeader('TECHNICAL'));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/customers', () => {
  it('creates a customer and returns 201 with the full customer object, normalizing "" email to null and defaulting status to active', async () => {
    mockedRepo.findByPhone.mockResolvedValue(null);
    mockedRepo.create.mockResolvedValue(baseCustomer({ email: null }) as never);

    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0910000000', address: '123 Nguyen Hue', email: '' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      customerId: 'c1',
      customerName: 'Nguyen Van A',
      phone: '0910000000',
      email: '',
      status: 'active',
      totalBookings: 0,
      totalSpent: 0,
    });
    expect(mockedRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: null, status: 'ACTIVE' }));
  });

  it('rejects a payload missing customerName/phone with 400', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader())
      .send({ address: '123 Nguyen Hue' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a payload missing the required address with 400', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0910000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a phone number that is not 10 digits starting with 0', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '191000000', address: '123 Nguyen Hue' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 PHONE_ALREADY_EXISTS when the phone is already registered to another customer', async () => {
    mockedRepo.findByPhone.mockResolvedValue(baseCustomer({ customerId: 'existing-customer' }) as never);

    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0910000000', address: '123 Nguyen Hue' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('is forbidden for non-manager roles', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader('ADMIN'))
      .send({ customerName: 'A', phone: '0910000000', address: '123 Nguyen Hue' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/customers/:customerId', () => {
  it('returns 404 when the customer does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/customers/missing').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/customers/:customerId', () => {
  it('updates the customer and returns the mapped result', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.update.mockResolvedValue(baseCustomer({ customerName: 'Updated', status: 'INACTIVE' }) as never);
    mockedRepo.getOrderStatsForCustomer.mockResolvedValue({ totalBookings: 0, totalSpent: 0 } as never);

    const res = await request(app)
      .put('/api/v1/customers/c1')
      .set('Authorization', authHeader())
      .send({ customerName: 'Updated', phone: '0910000000', status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ customerName: 'Updated', status: 'inactive' });
  });
});

describe('DELETE /api/v1/customers/:customerId', () => {
  it('returns 409 Conflict when the customer already has orders', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.countOrders.mockResolvedValue(3);

    const res = await request(app).delete('/api/v1/customers/c1').set('Authorization', authHeader());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(mockedRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes successfully when the customer has no orders', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.countOrders.mockResolvedValue(0);

    const res = await request(app).delete('/api/v1/customers/c1').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedRepo.delete).toHaveBeenCalledWith('c1');
  });
});

describe('GET /api/v1/customers/:customerId/summary', () => {
  it('computes paidAmount by joining deposits + settlements, not orders.payment_status', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.getOrderIdsForCustomer.mockResolvedValue(['o1']);
    mockedRepo.getOrderStatsForCustomer.mockResolvedValue({ totalBookings: 1, totalSpent: 411000000 } as never);
    mockedRepo.sumSuccessfulDeposits.mockResolvedValue({ _sum: { amount: 411000000 } } as never);
    mockedRepo.sumSettledAmounts.mockResolvedValue({ _sum: { finalAmount: 0 } } as never);
    mockedRepo.countActiveOrders.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/customers/c1/summary').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalValue: 411000000,
      paidAmount: 411000000,
      remainingDebt: 0,
      paymentRate: 100,
      activeOrdersCount: 1,
    });
  });
});

describe('GET /api/v1/customers/:customerId/orders', () => {
  it('returns paginated orders defaulting to limit=6', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.listOrders.mockResolvedValue({
      rows: [
        {
          orderId: 'o1',
          eventType: 'WEDDING',
          eventName: null,
          eventDate: new Date('2026-02-23T17:00:00Z'),
          totalAmount: 411000000,
          orderStatus: 'COMPLETED',
          creator: { fullName: 'Nguyen Van A' },
        },
      ],
      totalItems: 2,
    } as never);

    const res = await request(app).get('/api/v1/customers/c1/orders').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 6, totalItems: 2, totalPages: 1 });
    expect(res.body.data[0]).toMatchObject({ orderId: 'o1', event: 'WEDDING', coordinator: 'Nguyen Van A' });
  });
});
