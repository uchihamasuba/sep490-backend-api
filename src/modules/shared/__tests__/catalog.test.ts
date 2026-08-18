import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { catalogRepository } from '../catalog.repository';
import { supplierRepository } from '../../operations/supplier.repository';

jest.mock('../catalog.repository', () => ({
  catalogRepository: {
    findMany: jest.fn(),
    typeExists: jest.fn(),
    generateNextItemCode: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    findComponentsByItemId: jest.fn(),
  },
}));

jest.mock('../../operations/supplier.repository', () => ({
  supplierRepository: {
    findSuppliersByItemId: jest.fn(),
  },
}));

jest.mock('../../inventory/inventory.service', () => ({
  inventoryService: {
    createInventory: jest.fn(),
  },
}));

const mockedRepo = catalogRepository as jest.Mocked<typeof catalogRepository>;
const mockedSupplierRepo = supplierRepository as jest.Mocked<typeof supplierRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF' = 'MANAGER') {
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
  it('UTCID01: View Equipment List', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 } as never);
    const res = await request(app).get('/api/v1/catalog/items');
    expect(res.status).toBe(401);
  });
  it('UTCID02: View Equipment List', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeItem({ inventory: { quantityTotal: 10, quantityDamaged: 2 } })], totalItems: 1 } as never);
    const res = await request(app).get('/api/v1/catalog/items').set('Authorization', authHeader('MANAGER'));
    expect(res.status).toBe(200);
  });
  it('UTCID03: View Equipment List', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 } as never);
    const res = await request(app).get('/api/v1/catalog/items?status=INVALID').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(400);
  });
  it('UTCID04: View Equipment List', async () => {
    mockedRepo.findMany.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));
    const res = await request(app).get('/api/v1/catalog/items').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(500);
  });
  it('UTCID05: View Equipment List', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeItem({ inventory: { quantityTotal: 10, quantityDamaged: 2 } })], totalItems: 1 } as never);
    const res = await request(app).get('/api/v1/catalog/items').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(200);
  });
  it('UTCID06: View Equipment List', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeItem({ inventory: { quantityTotal: 10, quantityDamaged: 2 } })], totalItems: 1 } as never);
    const res = await request(app).get('/api/v1/catalog/items').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/catalog/items', () => {
  it('UTCID01: Create Equipment', async () => {
    
    const res = await request(app).post('/api/v1/catalog/items').send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 100000 });
    expect(res.status).toBe(401);
  });
  it('UTCID02: Create Equipment', async () => {
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.generateNextItemCode.mockResolvedValue('ITM-002');
    mockedRepo.create.mockResolvedValue(fakeItem({ itemId: 'item-2', itemCode: 'ITM-002' }) as never);
    const res = await request(app).post('/api/v1/catalog/items').set('Authorization', authHeader('MANAGER')).send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 100000 });
    expect(res.status).toBe(201);
  });
  it('UTCID03: Create Equipment', async () => {
    
    const res = await request(app).post('/api/v1/catalog/items').set('Authorization', authHeader('ADMIN')).send({ itemName: 'Máy chiếu' });
    expect(res.status).toBe(400);
  });
  it('UTCID04: Create Equipment', async () => {
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.create.mockRejectedValue(new Error('DB Error'));
    const res = await request(app).post('/api/v1/catalog/items').set('Authorization', authHeader('ADMIN')).send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 100000 });
    expect(res.status).toBe(500);
  });
  it('UTCID05: Create Equipment', async () => {
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.create.mockRejectedValue(new Error('DB Error'));
    const res = await request(app).post('/api/v1/catalog/items').set('Authorization', authHeader('ADMIN')).send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 100000 });
    expect(res.status).toBe(500);
  });
  it('UTCID06: Create Equipment', async () => {
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.generateNextItemCode.mockResolvedValue('ITM-002');
    mockedRepo.create.mockResolvedValue(fakeItem({ itemId: 'item-2', itemCode: 'ITM-002' }) as never);
    const res = await request(app).post('/api/v1/catalog/items').set('Authorization', authHeader('ADMIN')).send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 100000 });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/v1/catalog/items/:itemId', () => {
  it('UTCID01: View Equipment Detail', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/catalog/items/null').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(404);
  });
  it('UTCID02: View Equipment Detail', async () => {
    
    const res = await request(app).get('/api/v1/catalog/items/EQ123');
    expect(res.status).toBe(401);
  });
  it('UTCID03: View Equipment Detail', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/catalog/items/NON_EXISTENT').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(404);
  });
  it('UTCID04: View Equipment Detail', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    const res = await request(app).get('/api/v1/catalog/items/EQ123').set('Authorization', authHeader('MANAGER'));
    expect(res.status).toBe(200);
  });
  it('UTCID05: View Equipment Detail', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('DB Error'));
    const res = await request(app).get('/api/v1/catalog/items/EQ123').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(500);
  });
  it('UTCID06: View Equipment Detail', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    const res = await request(app).get('/api/v1/catalog/items/EQ123').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/catalog/items/:itemId/suppliers', () => {
  it('returns list of suppliers for an item', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedSupplierRepo.findSuppliersByItemId.mockResolvedValue([
      {
        itemId: 'item-1',
        supplierId: 'sup-1',
        createdAt: new Date('2026-07-27T00:00:00Z'),
        updatedAt: new Date('2026-07-27T00:00:00Z'),
        rentalPrice: 50000,
          purchasePrice: 100000,
        isActive: true,
        minQuantity: null,
        supplierItemCode: 'CODE',
        supplier: {
          supplierCode: 'SUP-001',
          supplierName: 'Nhà cung cấp A',
          serviceType: 'Âm thanh',
          phone: '0123456789',
          email: null,
          address: null,
        }
      }
    ] as never);

    const res = await request(app)
      .get('/api/v1/catalog/items/item-1/suppliers')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      itemId: 'item-1',
      supplierId: 'sup-1',
      supplierCode: 'SUP-001',
      supplierName: 'Nhà cung cấp A',
    });
  });

  it('returns 404 if item does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/v1/catalog/items/missing/suppliers')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/catalog/items/:itemId', () => {
  it('UTCID01: Update Equipment', async () => {
    
    const res = await request(app).put('/api/v1/catalog/items/EQ123').send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 120000 });
    expect(res.status).toBe(401);
  });
  it('UTCID02: Update Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.update.mockResolvedValue(fakeItem({ itemName: 'Loa JBL 2000W' }) as never);
    const res = await request(app).put('/api/v1/catalog/items/EQ123').set('Authorization', authHeader('MANAGER')).send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 120000 });
    expect(res.status).toBe(200);
  });
  it('UTCID03: Update Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).put('/api/v1/catalog/items/NON_EXISTENT').set('Authorization', authHeader('ADMIN')).send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 120000 });
    expect(res.status).toBe(404);
  });
  it('UTCID04: Update Equipment', async () => {
    
    const res = await request(app).put('/api/v1/catalog/items/EQ123').set('Authorization', authHeader('ADMIN')).send({ itemName: 'Máy chiếu' });
    expect(res.status).toBe(400);
  });
  it('UTCID05: Update Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.update.mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/api/v1/catalog/items/EQ123').set('Authorization', authHeader('ADMIN')).send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 120000 });
    expect(res.status).toBe(500);
  });
  it('UTCID06: Update Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.update.mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/api/v1/catalog/items/EQ123').set('Authorization', authHeader('ADMIN')).send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 120000 });
    expect(res.status).toBe(500);
  });
  it('UTCID07: Update Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.typeExists.mockResolvedValue({ typeId: 'type-1' } as never);
    mockedRepo.update.mockResolvedValue(fakeItem({ itemName: 'Loa JBL 2000W' }) as never);
    const res = await request(app).put('/api/v1/catalog/items/EQ123').set('Authorization', authHeader('ADMIN')).send({ itemName: 'Máy chiếu', typeId: 'type-1', unit: 'Cái', rentalPrice: 120000 });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/v1/catalog/items/:itemId/status', () => {
  it('UTCID01: Deactivate Equipment', async () => {
    
    const res = await request(app).patch('/api/v1/catalog/items/EQ123/status').send({ status: 'INACTIVE' });
    expect(res.status).toBe(401);
  });
  it('UTCID02: Deactivate Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.updateStatus.mockResolvedValue(fakeItem({ status: 'INACTIVE' }) as never);
    const res = await request(app).patch('/api/v1/catalog/items/EQ123/status').set('Authorization', authHeader('MANAGER')).send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
  });
  it('UTCID03: Deactivate Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).patch('/api/v1/catalog/items/NON_EXISTENT/status').set('Authorization', authHeader('ADMIN')).send({ status: 'INACTIVE' });
    expect(res.status).toBe(404);
  });
  it('UTCID04: Deactivate Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.updateStatus.mockResolvedValue(fakeItem({ status: 'INACTIVE' }) as never);
    const res = await request(app).patch('/api/v1/catalog/items/EQ123/status').set('Authorization', authHeader('ADMIN')).send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
  });
  it('UTCID05: Deactivate Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.updateStatus.mockRejectedValue(new Error('DB error'));
    const res = await request(app).patch('/api/v1/catalog/items/EQ123/status').set('Authorization', authHeader('ADMIN')).send({ status: 'INACTIVE' });
    expect(res.status).toBe(500);
  });
  it('UTCID06: Deactivate Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.updateStatus.mockRejectedValue(new Error('DB error'));
    const res = await request(app).patch('/api/v1/catalog/items/EQ123/status').set('Authorization', authHeader('ADMIN')).send({ status: 'INACTIVE' });
    expect(res.status).toBe(500);
  });
  it('UTCID07: Deactivate Equipment', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.updateStatus.mockResolvedValue(fakeItem({ status: 'INACTIVE' }) as never);
    const res = await request(app).patch('/api/v1/catalog/items/EQ123/status').set('Authorization', authHeader('ADMIN')).send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/catalog/items/:itemId/components', () => {
  it('returns the components mapped properly', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.findComponentsByItemId.mockResolvedValue([
      {
        id: 'comp-1',
        parentId: 'item-1',
        childId: 'child-1',
        quantity: 2,
        child: { 
          itemCode: 'CHL-001', 
          itemName: 'Micro Shure SM58', 
          unit: 'Cái',
          inventory: { quantityTotal: 10, quantityDamaged: 2 },
        },
      },
    ] as never);

    const res = await request(app)
      .get('/api/v1/catalog/items/item-1/components')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      componentId: 'comp-1',
      childItemId: 'child-1',
      childItemCode: 'CHL-001',
      childItemName: 'Micro Shure SM58',
      unit: 'Cái',
      quantity: 2,
      quantityAvailable: 8,
    });
  });

  it('returns empty array when item has no components', async () => {
    mockedRepo.findById.mockResolvedValue(fakeItem() as never);
    mockedRepo.findComponentsByItemId.mockResolvedValue([] as never);

    const res = await request(app)
      .get('/api/v1/catalog/items/item-1/components')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 404 when parent item does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/v1/catalog/items/missing/components')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});
