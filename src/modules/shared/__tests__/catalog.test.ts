import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { catalogRepository } from '../catalog.repository';

jest.mock('../catalog.repository', () => ({
  catalogRepository: {
    findMany: jest.fn(),
    typeExists: jest.fn(),
    generateNextItemCode: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

const mockedRepo = catalogRepository as jest.Mocked<typeof catalogRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeItem(overrides: Record<string, unknown> = {}) {
  return {
    itemId: 'item-1',
    itemCode: 'ITM-001',
    itemName: 'Loa JBL 1000W',
    typeId: 'type-1',
    type: { typeId: 'type-1', typeName: 'Loa', categoryId: 'cat-1', category: { categoryId: 'cat-1', categoryName: 'Âm thanh' } },
    description: null,
    unit: 'Cái',
    rentalPrice: 500000,
    purchasePrice: null,
    priceValidFrom: null,
    priceValidTo: null,
    imageUrl: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/v1/catalog/items', () => {
  it('returns all items unpaginated when page/limit are omitted', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeItem()], totalItems: 1 } as never);

    const res = await request(app).get('/api/v1/catalog/items?status=ACTIVE').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', skip: undefined, take: undefined }));
    expect(res.body.meta).toEqual({ page: null, limit: null, totalItems: 1, totalPages: null });
    expect(res.body.data[0]).toMatchObject({ itemId: 'item-1', typeName: 'Loa', categoryName: 'Âm thanh', rentalPrice: 500000 });
  });

  it('paginates when page/limit are provided', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 } as never);

    const res = await request(app).get('/api/v1/catalog/items?page=1&limit=10').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    expect(res.body.meta).toEqual({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
  });

  it('rejects an invalid status filter with 400', async () => {
    const res = await request(app).get('/api/v1/catalog/items?status=DELETED').set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(mockedRepo.findMany).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/catalog/items', () => {
  it('creates a new catalog item', async () => {
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.generateNextItemCode.mockResolvedValue('ITM-002');
    mockedRepo.create.mockResolvedValue(fakeItem({ itemId: 'item-2', itemCode: 'ITM-002' }) as never);

    const res = await request(app)
      .post('/api/v1/catalog/items')
      .set('Authorization', authHeader())
      .send({ itemName: 'Đèn Beam 230', typeId: 'type-1', unit: 'Cái', rentalPrice: 300000 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ itemId: 'item-2', itemCode: 'ITM-002' });
  });

  it('returns 404 when typeId does not exist', async () => {
    mockedRepo.typeExists.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/catalog/items')
      .set('Authorization', authHeader())
      .send({ itemName: 'Ghost item', typeId: 'ghost-type', unit: 'Cái' });

    expect(res.status).toBe(404);
  });

  it('rejects missing required fields with 400', async () => {
    const res = await request(app).post('/api/v1/catalog/items').set('Authorization', authHeader()).send({ itemName: 'No type' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.typeExists).not.toHaveBeenCalled();
  });

  it('is forbidden for non-Manager roles', async () => {
    const res = await request(app)
      .post('/api/v1/catalog/items')
      .set('Authorization', authHeader('ADMIN'))
      .send({ itemName: 'Đèn Beam 230', typeId: 'type-1', unit: 'Cái' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/catalog/items/:itemId', () => {
  it('returns the item detail', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);

    const res = await request(app).get('/api/v1/catalog/items/item-1').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ itemId: 'item-1', itemName: 'Loa JBL 1000W' });
  });

  it('returns 404 when the item does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/catalog/items/missing').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/catalog/items/:itemId', () => {
  it('updates the item and returns the mapped result', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.update.mockResolvedValue(fakeItem({ itemName: 'Loa JBL 2000W' }) as never);

    const res = await request(app)
      .put('/api/v1/catalog/items/item-1')
      .set('Authorization', authHeader())
      .send({ itemName: 'Loa JBL 2000W', typeId: 'type-1', unit: 'Cái', rentalPrice: 600000 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ itemName: 'Loa JBL 2000W' });
  });

  it('returns 404 when the item does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .put('/api/v1/catalog/items/missing')
      .set('Authorization', authHeader())
      .send({ itemName: 'X', typeId: 'type-1', unit: 'Cái', rentalPrice: 1 });
    expect(res.status).toBe(404);
  });

  it('is forbidden for non-Manager roles', async () => {
    const res = await request(app)
      .put('/api/v1/catalog/items/item-1')
      .set('Authorization', authHeader('ADMIN'))
      .send({ itemName: 'X', typeId: 'type-1', unit: 'Cái', rentalPrice: 1 });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/catalog/items/:itemId/status', () => {
  it('updates the status and returns the mapped result', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.updateStatus.mockResolvedValue(fakeItem({ status: 'INACTIVE' }) as never);

    const res = await request(app)
      .patch('/api/v1/catalog/items/item-1/status')
      .set('Authorization', authHeader())
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('INACTIVE');
  });

  it('rejects an invalid status with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/catalog/items/item-1/status')
      .set('Authorization', authHeader())
      .send({ status: 'DELETED' });
    expect(res.status).toBe(400);
  });
});
