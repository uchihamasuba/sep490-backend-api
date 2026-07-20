import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { catalogTypeRepository } from '../catalog.repository';

jest.mock('../catalog.repository', () => {
  const actual = jest.requireActual('../catalog.repository');
  return {
    ...actual,
    catalogTypeRepository: {
      findMany: jest.fn(),
    },
  };
});

const mockedRepo = catalogTypeRepository as jest.Mocked<typeof catalogTypeRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeType(overrides: Record<string, unknown> = {}) {
  return {
    typeId: 'type-1',
    categoryId: 'cat-1',
    category: { categoryName: 'Âm thanh' },
    typeName: 'Loa',
    description: null,
    imageUrl: null,
    isActive: true,
    ...overrides,
  };
}

describe('GET /api/v1/catalog/types', () => {
  it('returns all types unpaginated when page/limit are omitted', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeType()], totalItems: 1 } as never);

    const res = await request(app).get('/api/v1/catalog/types').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ typeId: 'type-1', typeName: 'Loa', categoryName: 'Âm thanh' });
    expect(res.body.meta).toEqual({ page: null, limit: null, totalItems: 1, totalPages: null });
  });

  it('filters by categoryId', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 } as never);

    await request(app).get('/api/v1/catalog/types?categoryId=cat-1').set('Authorization', authHeader());

    expect(mockedRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat-1' }));
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/catalog/types');
    expect(res.status).toBe(401);
  });
});
