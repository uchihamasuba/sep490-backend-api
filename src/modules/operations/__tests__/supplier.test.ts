import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { ActiveStatus } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { supplierRepository, supplierTransactionRepository } from '../supplier.repository';

jest.mock('../supplier.repository', () => ({
  supplierRepository: {
    findMany: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findItemsBySupplierId: jest.fn(),
    sumOutstandingBySupplierIds: jest.fn(),
    sumOutstandingForSupplier: jest.fn(),
    generateNextSupplierCode: jest.fn(),
  },
  supplierTransactionRepository: {
    findMany: jest.fn(),
  },
}));

const mockedSupplierRepo = supplierRepository as jest.Mocked<typeof supplierRepository>;
const mockedTransactionRepo = supplierTransactionRepository as jest.Mocked<typeof supplierTransactionRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

interface FakeSupplier {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  rating: number | null;
  notes: string | null;
  status: ActiveStatus;
  createdAt: Date;
  updatedAt: Date;
}

function baseSupplier(overrides: Partial<FakeSupplier> = {}): FakeSupplier {
  return {
    supplierId: 's1',
    supplierCode: 'SUP001',
    supplierName: 'Am thanh Sai Gon',
    serviceType: 'Am thanh bieu dien',
    contactPerson: 'Nguyen Van B',
    phone: '0910000000',
    email: null,
    address: '123 Le Loi',
    rating: null,
    notes: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/v1/suppliers', () => {
  it('returns a paginated list with debtBalance computed from outstanding transactions', async () => {
    mockedSupplierRepo.findMany.mockResolvedValue({ rows: [baseSupplier()], totalItems: 1 } as never);
    mockedSupplierRepo.sumOutstandingBySupplierIds.mockResolvedValue([
      { supplierId: 's1', _sum: { estimatedCost: 5000000, depositAmount: 2000000 } },
    ] as never);

    const res = await request(app).get('/api/v1/suppliers').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ supplierId: 's1', debtBalance: 3000000 });
    expect(res.body.meta).toEqual({ page: 1, limit: 20, totalItems: 1, totalPages: 1 });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/suppliers');
    expect(res.status).toBe(401);
  });

  it('rejects roles outside manager/admin with 403', async () => {
    const res = await request(app).get('/api/v1/suppliers').set('Authorization', authHeader('STAFF'));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/suppliers/next-code', () => {
  it('returns the next supplier code generated from repository', async () => {
    mockedSupplierRepo.generateNextSupplierCode.mockResolvedValue('SUP-005');

    const res = await request(app).get('/api/v1/suppliers/next-code').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ code: 'SUP-005' });
    expect(mockedSupplierRepo.generateNextSupplierCode).toHaveBeenCalled();
  });

  it('rejects roles outside manager/admin with 403', async () => {
    const res = await request(app).get('/api/v1/suppliers/next-code').set('Authorization', authHeader('STAFF'));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/suppliers', () => {
  it('creates a supplier and returns 201', async () => {
    mockedSupplierRepo.findByCode.mockResolvedValue(null);
    mockedSupplierRepo.create.mockResolvedValue(baseSupplier() as never);

    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', authHeader())
      .send({
        supplierCode: 'SUP001',
        supplierName: 'Am thanh Sai Gon',
        serviceType: 'Am thanh bieu dien',
        contactPerson: 'Nguyen Van B',
        phone: '0910000000',
        address: '123 Le Loi',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ supplierId: 's1', supplierCode: 'SUP001', debtBalance: 0 });
    expect(mockedSupplierRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ supplierCode: 'SUP001', status: 'ACTIVE' }),
    );
  });

  it('rejects a payload missing required fields with 400', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', authHeader())
      .send({ supplierName: 'Am thanh Sai Gon' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedSupplierRepo.create).not.toHaveBeenCalled();
  });

  it('returns 409 SUPPLIER_CODE_ALREADY_EXISTS when the code is already registered', async () => {
    mockedSupplierRepo.findByCode.mockResolvedValue(baseSupplier() as never);

    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', authHeader())
      .send({ supplierCode: 'SUP001', supplierName: 'Am thanh Sai Gon', serviceType: 'Am thanh' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SUPPLIER_CODE_ALREADY_EXISTS');
    expect(res.body.error.message).toBe('Mã nhà cung cấp đã tồn tại trong hệ thống');
    expect(mockedSupplierRepo.create).not.toHaveBeenCalled();
  });

  it('is forbidden for non-manager roles', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', authHeader('ADMIN'))
      .send({ supplierCode: 'SUP002', supplierName: 'A', serviceType: 'B' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/suppliers/:id', () => {
  it('returns 404 when the supplier does not exist', async () => {
    mockedSupplierRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/suppliers/missing').set('Authorization', authHeader());
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Không tìm thấy nhà cung cấp');
  });

  it('returns the supplier with computed debtBalance', async () => {
    mockedSupplierRepo.findById.mockResolvedValue(baseSupplier() as never);
    mockedSupplierRepo.sumOutstandingForSupplier.mockResolvedValue({ estimatedCost: 1000000, depositAmount: 1000000 } as never);

    const res = await request(app).get('/api/v1/suppliers/s1').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ supplierId: 's1', debtBalance: 0 });
  });
});

describe('GET /api/v1/suppliers/:id/items', () => {
  it('returns 404 when the supplier does not exist', async () => {
    mockedSupplierRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/suppliers/missing/items').set('Authorization', authHeader());
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Không tìm thấy nhà cung cấp');
  });

  it('returns the list of items for the supplier', async () => {
    mockedSupplierRepo.findById.mockResolvedValue(baseSupplier() as never);
    mockedSupplierRepo.findItemsBySupplierId.mockResolvedValue({
      rows: [
        {
          supplierId: 's1',
          itemId: 'i1',
          createdAt: new Date('2026-01-10T00:00:00Z'),
          updatedAt: new Date('2026-01-10T00:00:00Z'),
          rentalPrice: 50000,
          purchasePrice: 100000,
          isActive: true,
          minQuantity: null,
          supplierItemCode: 'CODE',
          item: {
            itemId: 'i1',
            itemCode: 'ITEM-01',
            itemName: 'Speaker',
            typeId: 't1',
            rentalPrice: 50000,
            purchasePrice: 100000,
          }
        }
      ],
      totalItems: 1
    } as never);

    const res = await request(app).get('/api/v1/suppliers/s1/items').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      supplierId: 's1',
      itemId: 'i1',
      itemName: 'Speaker',
      rentalPrice: 50000,
      purchasePrice: 100000,
    });
  });
});

describe('PUT /api/v1/suppliers/:id', () => {
  it('updates the supplier and returns the mapped result', async () => {
    mockedSupplierRepo.findById.mockResolvedValue(baseSupplier() as never);
    mockedSupplierRepo.update.mockResolvedValue(baseSupplier({ status: 'INACTIVE' }) as never);
    mockedSupplierRepo.sumOutstandingForSupplier.mockResolvedValue({ estimatedCost: 0, depositAmount: 0 } as never);

    const res = await request(app)
      .put('/api/v1/suppliers/s1')
      .set('Authorization', authHeader())
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'INACTIVE' });
    expect(mockedSupplierRepo.update).toHaveBeenCalledWith('s1', { status: 'INACTIVE' });
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(app).put('/api/v1/suppliers/s1').set('Authorization', authHeader()).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when the supplier does not exist', async () => {
    mockedSupplierRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .put('/api/v1/suppliers/missing')
      .set('Authorization', authHeader())
      .send({ status: 'INACTIVE' });
    expect(res.status).toBe(404);
  });

  it('throws CANNOT_DEACTIVATE_WITH_DEBT when setting status to INACTIVE with debt > 0', async () => {
    mockedSupplierRepo.findById.mockResolvedValue(baseSupplier() as never);
    mockedSupplierRepo.sumOutstandingForSupplier.mockResolvedValue({ estimatedCost: 5000000, depositAmount: 2000000 } as never);
    // clear the update mock to ensure it's not called
    mockedSupplierRepo.update.mockClear();

    const res = await request(app)
      .put('/api/v1/suppliers/s1')
      .set('Authorization', authHeader())
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_WITH_DEBT');
    expect(mockedSupplierRepo.update).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/suppliers/:id/status', () => {
  it('updates the status and returns mapped result', async () => {
    mockedSupplierRepo.findById.mockResolvedValue(baseSupplier() as never);
    mockedSupplierRepo.update.mockResolvedValue(baseSupplier({ status: 'INACTIVE' }) as never);
    mockedSupplierRepo.sumOutstandingForSupplier.mockResolvedValue({ estimatedCost: 0, depositAmount: 0 } as never);

    const res = await request(app)
      .patch('/api/v1/suppliers/s1/status')
      .set('Authorization', authHeader())
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'INACTIVE' });
    expect(mockedSupplierRepo.update).toHaveBeenCalledWith('s1', { status: 'INACTIVE' });
  });

  it('throws CANNOT_DEACTIVATE_WITH_DEBT when setting status to INACTIVE with debt > 0', async () => {
    mockedSupplierRepo.findById.mockResolvedValue(baseSupplier() as never);
    mockedSupplierRepo.sumOutstandingForSupplier.mockResolvedValue({ estimatedCost: 5000000, depositAmount: 2000000 } as never);
    mockedSupplierRepo.update.mockClear();

    const res = await request(app)
      .patch('/api/v1/suppliers/s1/status')
      .set('Authorization', authHeader())
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_WITH_DEBT');
    expect(mockedSupplierRepo.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/supplier-transactions', () => {
  it('returns a paginated list of transactions joined with supplier/order', async () => {
    mockedTransactionRepo.findMany.mockResolvedValue({
      rows: [
        {
          transactionId: 't1',
          transactionCode: 'TXN-001',
          supplierId: 's1',
          orderId: 'o1',
          transactionType: 'RENTAL',
          serviceTitle: 'Thue am thanh',
          estimatedCost: 5000000,
          depositAmount: 2000000,
          paymentStatus: 'DEPOSITED',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T00:00:00Z'),
          updatedAt: new Date('2026-01-10T00:00:00Z'),
          supplier: { supplierId: 's1', supplierName: 'Am thanh Sai Gon' },
          order: { orderId: 'o1', orderCode: 'ORD-001' },
        },
      ],
      totalItems: 1,
    } as never);

    const res = await request(app)
      .get('/api/v1/supplier-transactions')
      .query({ supplierId: 's1' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      transactionId: 't1',
      supplierName: 'Am thanh Sai Gon',
      orderCode: 'ORD-001',
      estimatedCost: 5000000,
    });
    expect(mockedTransactionRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ supplierId: 's1', skip: 0, take: 20 }),
    );
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/supplier-transactions');
    expect(res.status).toBe(401);
  });
});
