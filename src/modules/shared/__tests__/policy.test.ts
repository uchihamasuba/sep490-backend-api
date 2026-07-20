import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { policyRepository } from '../policy.repository';

jest.mock('../policy.repository', () => ({
  policyRepository: {
    findMany: jest.fn(),
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
