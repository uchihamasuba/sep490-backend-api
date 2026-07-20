import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { catalogCategoryRepository } from '../catalog.repository';

jest.mock('../catalog.repository', () => {
  const actual = jest.requireActual('../catalog.repository');
  return {
    ...actual,
    catalogCategoryRepository: {
      findMany: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
});

const mockedRepo = catalogCategoryRepository as jest.Mocked<typeof catalogCategoryRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'ADMIN') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeCategory(overrides: Record<string, unknown> = {}) {
  return { categoryId: 'cat-1', categoryName: 'Bàn ghế', description: null, ...overrides };
}

describe('GET /api/v1/catalog/categories', () => {
  it('returns all categories unpaginated when page/limit are omitted', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeCategory()], totalItems: 1 } as never);

    const res = await request(app).get('/api/v1/catalog/categories').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ categoryId: 'cat-1', categoryName: 'Bàn ghế' });
    expect(res.body.meta).toEqual({ page: null, limit: null, totalItems: 1, totalPages: null });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/catalog/categories');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/catalog/categories', () => {
  it('creates a category and returns 201', async () => {
    mockedRepo.create.mockResolvedValue(fakeCategory({ categoryId: 'cat-2', categoryName: 'Âm thanh' }) as never);

    const res = await request(app)
      .post('/api/v1/catalog/categories')
      .set('Authorization', authHeader())
      .send({ categoryName: 'Âm thanh' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ categoryId: 'cat-2', categoryName: 'Âm thanh' });
  });

  it('rejects a blank categoryName with 400', async () => {
    const res = await request(app).post('/api/v1/catalog/categories').set('Authorization', authHeader()).send({ categoryName: '' });
    expect(res.status).toBe(400);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('is forbidden for non-Admin roles', async () => {
    const res = await request(app)
      .post('/api/v1/catalog/categories')
      .set('Authorization', authHeader('MANAGER'))
      .send({ categoryName: 'Âm thanh' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/catalog/categories/:categoryId', () => {
  it('updates the category and returns the mapped result', async () => {
    mockedRepo.findById.mockResolvedValue(fakeCategory() as never);
    mockedRepo.update.mockResolvedValue(fakeCategory({ categoryName: 'Bàn ghế cao cấp' }) as never);

    const res = await request(app)
      .put('/api/v1/catalog/categories/cat-1')
      .set('Authorization', authHeader())
      .send({ categoryName: 'Bàn ghế cao cấp' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ categoryName: 'Bàn ghế cao cấp' });
  });

  it('returns 404 when the category does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .put('/api/v1/catalog/categories/missing')
      .set('Authorization', authHeader())
      .send({ categoryName: 'X' });
    expect(res.status).toBe(404);
  });
});
