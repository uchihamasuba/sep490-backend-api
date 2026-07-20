import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { policyRepository } from '../policy.repository';

jest.mock('../policy.repository', () => ({
  policyRepository: {
    findMany: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

const mockedRepo = policyRepository as jest.Mocked<typeof policyRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakePolicy(overrides: Record<string, unknown> = {}) {
  return {
    policyId: 'pol-1',
    policyCode: 'POL-001',
    policyName: 'Cọc 50%',
    policyType: 'DEPOSIT',
    description: null,
    policyValue: 50,
    unit: '%',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/v1/policies', () => {
  it('lists policies with default pagination', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakePolicy()], totalItems: 1 } as never);

    const res = await request(app).get('/api/v1/policies').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ policyId: 'pol-1', policyType: 'DEPOSIT', policyValue: 50 });
    expect(res.body.meta).toEqual({ page: 1, limit: 50, totalItems: 1, totalPages: 1 });
  });

  it('filters by policyType', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 });

    await request(app).get('/api/v1/policies?policyType=CANCELLATION').set('Authorization', authHeader());

    expect(mockedRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ policyType: 'CANCELLATION' }));
  });

  it('rejects an invalid policyType with 400', async () => {
    const res = await request(app).get('/api/v1/policies?policyType=UNKNOWN').set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(mockedRepo.findMany).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/policies');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/policies', () => {
  it('creates a policy and returns 201', async () => {
    mockedRepo.findByCode.mockResolvedValue(null);
    mockedRepo.create.mockResolvedValue(fakePolicy({ policyId: 'pol-2', policyType: 'WAGE' }) as never);

    const res = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', authHeader('ADMIN'))
      .send({ policyCode: 'CONG-LEADER', policyName: 'Tiền công Leader', policyType: 'WAGE', policyValue: 500000, unit: 'VNĐ/buổi' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ policyId: 'pol-2', policyType: 'WAGE' });
  });

  it('returns 409 when policyCode already exists', async () => {
    mockedRepo.findByCode.mockResolvedValue(fakePolicy() as never);

    const res = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', authHeader('ADMIN'))
      .send({ policyCode: 'POL-001', policyName: 'X', policyType: 'DEPOSIT', policyValue: 1, unit: '%' });

    expect(res.status).toBe(409);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a negative policyValue with 400', async () => {
    const res = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', authHeader('ADMIN'))
      .send({ policyCode: 'X', policyName: 'X', policyType: 'DEPOSIT', policyValue: -1, unit: '%' });
    expect(res.status).toBe(400);
  });

  it('is forbidden for non-Admin roles', async () => {
    const res = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', authHeader('MANAGER'))
      .send({ policyCode: 'X', policyName: 'X', policyType: 'DEPOSIT', policyValue: 1, unit: '%' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/policies/:policyId', () => {
  it('updates policyValue/unit/description/isActive and returns the mapped result', async () => {
    mockedRepo.findById.mockResolvedValue(fakePolicy() as never);
    mockedRepo.update.mockResolvedValue(fakePolicy({ policyValue: 100, isActive: false }) as never);

    const res = await request(app)
      .put('/api/v1/policies/pol-1')
      .set('Authorization', authHeader('ADMIN'))
      .send({ policyValue: 100, isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ policyValue: 100, isActive: false });
  });

  it('supports the quick toggle payload (isActive only)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePolicy() as never);
    mockedRepo.update.mockResolvedValue(fakePolicy({ isActive: false }) as never);

    const res = await request(app).put('/api/v1/policies/pol-1').set('Authorization', authHeader('ADMIN')).send({ isActive: false });

    expect(res.status).toBe(200);
    expect(mockedRepo.update).toHaveBeenCalledWith('pol-1', { isActive: false });
  });

  it('returns 404 when the policy does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).put('/api/v1/policies/missing').set('Authorization', authHeader('ADMIN')).send({ isActive: false });
    expect(res.status).toBe(404);
  });

  it('rejects a request that tries to change policyCode with 400 (immutable after creation)', async () => {
    const res = await request(app)
      .put('/api/v1/policies/pol-1')
      .set('Authorization', authHeader('ADMIN'))
      .send({ policyCode: 'NEW-CODE', isActive: false });
    expect(res.status).toBe(400);
    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  it('is forbidden for non-Admin roles', async () => {
    const res = await request(app).put('/api/v1/policies/pol-1').set('Authorization', authHeader('MANAGER')).send({ isActive: false });
    expect(res.status).toBe(403);
  });
});
