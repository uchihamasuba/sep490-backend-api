import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { ActiveStatus } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { customerRepository } from '../customer.repository';

jest.mock('../customer.repository', () => ({
  customerRepository: {
    findMany: jest.fn(),
    generateNextCustomerCode: jest.fn(),
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

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF' = 'MANAGER') {
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

  it('allows STAFF to access', async () => {
    const res = await request(app).get('/api/v1/customers').set('Authorization', authHeader('STAFF'));
    expect(res.status).toBe(200);
  });

  // UTCID01: no authenticated user -> Expected: 401
  it('UTCID01: returns 401 when there is no Authorization header', async () => {
    const res = await request(app).get('/api/v1/customers');
    expect(res.status).toBe(401);
  });

  // UTCID02: role Staff -> Expected: 200 (now authorized)
  it('UTCID02: returns 200 for a Staff role', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [baseCustomer()], totalItems: 46 });
    mockedRepo.countByStatus.mockResolvedValue({ all: 46, active: 40, inactive: 6 });
    mockedRepo.getOrderStatsByCustomerIds.mockResolvedValue([]);
    const res = await request(app).get('/api/v1/customers').set('Authorization', authHeader('STAFF'));
    expect(res.status).toBe(200);
  });

  // UTCID03: invalid status filter -> Expected: 400
  it('UTCID03: returns 400 for an invalid status filter', async () => {
    const res = await request(app)
      .get('/api/v1/customers')
      .query({ status: 'INVALID_STATUS' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.findMany).not.toHaveBeenCalled();
  });

  // UTCID04: repository failure -> Expected: 500
  it('UTCID04: returns 500 when the repository throws (DB connection error)', async () => {
    mockedRepo.findMany.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app).get('/api/v1/customers').set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });

  // UTCID05: search term matching nothing -> Expected: 200 with an empty list
  it('UTCID05: returns 200 with an empty list when the search matches no customer', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 });
    mockedRepo.countByStatus.mockResolvedValue({ all: 0, active: 0, inactive: 0 });
    mockedRepo.getOrderStatsByCustomerIds.mockResolvedValue([] as never);

    const res = await request(app)
      .get('/api/v1/customers')
      .query({ search: 'KH_AO_123' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  // UTCID06: search term matching an existing customer -> Expected: 200 with results
  it('UTCID06: returns 200 with matching results for a valid search term', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [baseCustomer({ customerName: 'Nguyen Van A' })], totalItems: 1 });
    mockedRepo.countByStatus.mockResolvedValue({ all: 1, active: 1, inactive: 0 });
    mockedRepo.getOrderStatsByCustomerIds.mockResolvedValue([] as never);

    const res = await request(app)
      .get('/api/v1/customers')
      .query({ search: 'Nguyen Van A' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ customerName: 'Nguyen Van A' });
  });
});

describe('GET /api/v1/customers/next-code', () => {
  it('returns the next preview customer code', async () => {
    mockedRepo.generateNextCustomerCode.mockResolvedValue('CUS-003');

    const res = await request(app).get('/api/v1/customers/next-code').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ nextCustomerCode: 'CUS-003' });
  });

  it('is not swallowed by the /:customerId route (never treats "next-code" as an id lookup)', async () => {
    mockedRepo.generateNextCustomerCode.mockResolvedValue('CUS-004');

    await request(app).get('/api/v1/customers/next-code').set('Authorization', authHeader());

    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects roles outside manager/admin with 403', async () => {
    const res = await request(app).get('/api/v1/customers/next-code').set('Authorization', authHeader('STAFF'));
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

  // UTCID01: no authenticated user -> Expected: 401
  it('UTCID01: returns 401 when there is no Authorization header', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .send({ customerName: 'Nguyen Van A', phone: '0987654321' });

    expect(res.status).toBe(401);
  });

  // UTCID02: role Staff -> Expected: 403 (requires Manager)
  it('UTCID02: returns 403 for a Staff role', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader('STAFF'))
      .send({ customerName: 'Nguyen Van A', phone: '0987654321' });

    expect(res.status).toBe(403);
  });

  // UTCID03: missing required customerName/phone -> Expected: 400
  it('UTCID03: returns 400 when customerName and phone are missing', async () => {
    const res = await request(app).post('/api/v1/customers').set('Authorization', authHeader()).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  // UTCID04: duplicate phone -> Expected: 409
  // (sheet's request body omits `address`, but createCustomerBodySchema requires it — added here so the
  // request actually reaches the duplicate-phone branch instead of failing validation first.)
  it('UTCID04: returns 409 when the phone number already exists', async () => {
    mockedRepo.findByPhone.mockResolvedValue(baseCustomer({ customerId: 'existing-customer' }) as never);

    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0987654321', address: 'HN' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  // UTCID05: repository failure on insert -> Expected: 500
  it('UTCID05: returns 500 when creating the customer fails', async () => {
    mockedRepo.findByPhone.mockResolvedValue(null);
    mockedRepo.create.mockRejectedValue(new Error('Đăng ký khách hàng thất bại'));

    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0987654321', address: 'HN' });

    expect(res.status).toBe(500);
  });

  // UTCID06: valid registration — documented Expected: 200, but customer.controller.ts's `created()` helper
  // always responds 201 for POST /customers, so we assert the actual (documented-vs-actual) behavior.
  it('UTCID06: returns 201 with the created customer for a valid registration', async () => {
    mockedRepo.findByPhone.mockResolvedValue(null);
    mockedRepo.create.mockResolvedValue(
      baseCustomer({ phone: '0987654321', email: 'a@gmail.com', address: 'HN' }) as never,
    );

    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0987654321', email: 'a@gmail.com', address: 'HN' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ customerName: 'Nguyen Van A', phone: '0987654321', email: 'a@gmail.com' });
  });
});

describe('GET /api/v1/customers/:customerId', () => {
  it('returns 404 when the customer does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/customers/missing').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  // UTCID01: missing customer_id -> Expected: 400
  // (a literal null/empty path segment can't be routed to `/:customerId` — a whitespace-only id exercises the
  // same params-schema branch: trim().min(1) rejects it, matching the documented "missing customer_id" case.)
  it('UTCID01: returns 400 when customer_id is missing (whitespace-only id fails validation)', async () => {
    const res = await request(app).get('/api/v1/customers/%20').set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  // UTCID02: no authenticated user -> Expected: 401
  it('UTCID02: returns 401 when there is no Authorization header', async () => {
    const res = await request(app).get('/api/v1/customers/CUS123');

    expect(res.status).toBe(401);
  });

  // UTCID03: customer_id does not exist -> Expected: 404
  it('UTCID03: returns 404 for a non-existent customer_id', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/customers/NON_EXISTENT').set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  // UTCID04: returns 404 for a Staff role if customer does not exist
  it('UTCID04: returns 404 for a Staff role', async () => {
    // In this test block, we mock customerService.getCustomerById to resolve to null
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/customers/CUS123').set('Authorization', authHeader('STAFF'));

    expect(res.status).toBe(404);
  });

  // UTCID05: repository failure -> Expected: 500
  it('UTCID05: returns 500 when the repository throws (DB connection error)', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app).get('/api/v1/customers/CUS123').set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });

  // UTCID06: valid request -> Expected: 200
  it('UTCID06: returns 200 with the customer for a valid request', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer({ customerId: 'CUS123' }) as never);
    mockedRepo.getOrderStatsForCustomer.mockResolvedValue({ totalBookings: 2, totalSpent: 1000 } as never);

    const res = await request(app).get('/api/v1/customers/CUS123').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ customerId: 'CUS123' });
  });
});

describe('PUT /api/v1/customers/:customerId', () => {
  it('updates the customer and returns the mapped result', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.findByPhone.mockResolvedValue(baseCustomer() as never);
    mockedRepo.update.mockResolvedValue(baseCustomer({ customerName: 'Updated', status: 'INACTIVE' }) as never);
    mockedRepo.getOrderStatsForCustomer.mockResolvedValue({ totalBookings: 0, totalSpent: 0 } as never);

    const res = await request(app)
      .put('/api/v1/customers/c1')
      .set('Authorization', authHeader())
      .send({ customerName: 'Updated', phone: '0910000000', status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ customerName: 'Updated', status: 'inactive' });
  });

  it('returns 409 PHONE_ALREADY_EXISTS when the new phone belongs to a different customer', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.findByPhone.mockResolvedValue(baseCustomer({ customerId: 'other-customer' }) as never);

    const res = await request(app)
      .put('/api/v1/customers/c1')
      .set('Authorization', authHeader())
      .send({ customerName: 'Updated', phone: '0922222222', status: 'inactive' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  // UTCID01: no authenticated user -> Expected: 401
  it('UTCID01: returns 401 when there is no Authorization header', async () => {
    const res = await request(app)
      .put('/api/v1/customers/CUS123')
      .send({ customerName: 'Nguyen Van A', phone: '0987654321', status: 'active' });

    expect(res.status).toBe(401);
  });

  // UTCID02: role Staff -> Expected: 403 (requires Manager)
  it('UTCID02: returns 403 for a Staff role', async () => {
    const res = await request(app)
      .put('/api/v1/customers/CUS123')
      .set('Authorization', authHeader('STAFF'))
      .send({ customerName: 'Nguyen Van A', phone: '0987654321', status: 'active' });

    expect(res.status).toBe(403);
  });

  // UTCID03: customer_id does not exist -> Expected: 404
  it('UTCID03: returns 404 for a non-existent customer_id', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/customers/NON_EXISTENT')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0987654321', status: 'active' });

    expect(res.status).toBe(404);
  });

  // UTCID04: missing required customerName/phone -> Expected: 400
  it('UTCID04: returns 400 when customerName and phone are missing', async () => {
    const res = await request(app)
      .put('/api/v1/customers/CUS123')
      .set('Authorization', authHeader())
      .send({ status: 'active' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  // UTCID05: new phone belongs to a different customer -> Expected: 409
  it('UTCID05: returns 409 when the new phone belongs to a different customer', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer({ customerId: 'CUS123' }) as never);
    mockedRepo.findByPhone.mockResolvedValue(
      baseCustomer({ customerId: 'other-customer', phone: '0999999999' }) as never,
    );

    const res = await request(app)
      .put('/api/v1/customers/CUS123')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0999999999', status: 'active' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  // UTCID06: repository failure on update -> Expected: 500
  it('UTCID06: returns 500 when updating the customer fails', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer({ customerId: 'CUS123' }) as never);
    mockedRepo.findByPhone.mockResolvedValue(baseCustomer({ customerId: 'CUS123' }) as never);
    mockedRepo.update.mockRejectedValue(new Error('Cập nhật thông tin khách hàng thất bại'));

    const res = await request(app)
      .put('/api/v1/customers/CUS123')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0987654321', status: 'active' });

    expect(res.status).toBe(500);
  });

  // UTCID07: valid update -> Expected: 200
  it('UTCID07: returns 200 with the updated customer for a valid update', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer({ customerId: 'CUS123' }) as never);
    mockedRepo.findByPhone.mockResolvedValue(baseCustomer({ customerId: 'CUS123' }) as never);
    mockedRepo.update.mockResolvedValue(baseCustomer({ customerId: 'CUS123', email: 'a@gmail.com' }) as never);
    mockedRepo.getOrderStatsForCustomer.mockResolvedValue({ totalBookings: 0, totalSpent: 0 } as never);

    const res = await request(app)
      .put('/api/v1/customers/CUS123')
      .set('Authorization', authHeader())
      .send({ customerName: 'Nguyen Van A', phone: '0987654321', email: 'a@gmail.com', status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ customerName: 'Nguyen Van A', email: 'a@gmail.com' });
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
