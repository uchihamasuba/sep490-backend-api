import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { scheduleRepository } from '../../operations/schedule.repository';
import { inventoryRepository } from '../inventory.repository';

// Mock repository — KHÔNG chạm DB thật (trước đây file này là integration test query trực tiếp trên
// prisma/seed.ts, nên mỗi lần seed data đổi là test vỡ dù logic nghiệp vụ không đổi gì). Theo đúng
// pattern jest.mock('../xxx.repository', ...) đã dùng ở customer.test.ts/catalog.test.ts/payment.test.ts.
jest.mock('../inventory.repository', () => ({
  inventoryRepository: {
    findMany: jest.fn(),
    findByItemId: jest.fn(),
    itemExists: jest.fn(),
    create: jest.fn(),
    orderExists: jest.fn(),
    reportExists: jest.fn(),
    reserve: jest.fn(),
    release: jest.fn(),
    adjustTotal: jest.fn(),
    createMovement: jest.fn(),
    findMovements: jest.fn(),
    findOrderItemsForPicklist: jest.fn(),
    findReports: jest.fn(),
    findReportById: jest.fn(),
    createReport: jest.fn(),
    confirmReportAndApplyInventory: jest.fn(),
    recordFieldOutbound: jest.fn(),
  },
}));

jest.mock('../../operations/schedule.repository', () => ({
  scheduleRepository: {
    isUserLeadOnOrder: jest.fn(),
  },
}));

const mockedRepo = inventoryRepository as jest.Mocked<typeof inventoryRepository>;
const mockedScheduleRepo = scheduleRepository as jest.Mocked<typeof scheduleRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeInventory(overrides: Record<string, unknown> = {}) {
  return {
    itemId: 'item-loa',
    quantityTotal: 10,
    quantityDamaged: 0,
    quantityReserved: 2,
    quantityAvailable: 8,
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    item: {
      itemName: 'Loa JBL 1000W',
      itemCode: 'ITM-001',
      unit: 'Cái',
      rentalPrice: 500000,
      purchasePrice: null,
      type: { typeName: 'Loa', category: { categoryName: 'Âm thanh' } },
    },
    ...overrides,
  };
}

function fakeMovement(overrides: Record<string, unknown> = {}) {
  return {
    movementId: 'mov-1',
    itemId: 'item-loa',
    orderId: null,
    reportId: null,
    movementType: 'OUTBOUND',
    quantity: 2,
    notes: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    item: { itemName: 'Loa JBL 1000W', unit: 'Cái' },
    performer: { userId: 'user-1', fullName: 'Team Leader' },
    ...overrides,
  };
}

function fakeReport(overrides: Record<string, unknown> = {}) {
  return {
    reportId: 'report-1',
    orderId: 'order-1',
    reportType: 'INTERNAL',
    transactionId: null,
    status: 'SUBMITTED',
    notes: 'Thu hồi thiết bị sau sự kiện Tech Summit 2026',
    confirmedAt: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    order: { orderCode: 'ORD-001' },
    reporter: { userId: 'leader-1', fullName: 'Team Leader' },
    confirmer: null,
    items: [
      {
        cerItemId: 'cer-1',
        itemId: 'item-loa',
        goodQuantity: 2,
        damagedQuantity: 1,
        lostQuantity: 0,
        notes: null,
        item: { itemName: 'Loa JBL 1000W', unit: 'Cái' },
      },
    ],
    ...overrides,
  };
}

describe('GET /api/v1/inventory', () => {
  it('lists inventory rows with correct joined fields', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeInventory()], totalItems: 1 } as never);

    const res = await request(app).get('/api/v1/inventory?limit=50').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      itemId: 'item-loa',
      itemName: 'Loa JBL 1000W',
      categoryName: 'Âm thanh',
      quantityTotal: 10,
      quantityReserved: 2,
      quantityAvailable: 8,
      quantityDamaged: 0,
    });
  });
});

describe('GET /api/v1/inventory/:itemId', () => {
  it('returns the inventory row for the given item', async () => {
    mockedRepo.findByItemId.mockResolvedValue(
      fakeInventory({ itemId: 'item-den', quantityTotal: 15, quantityDamaged: 1, quantityReserved: 2, quantityAvailable: 12, item: { ...fakeInventory().item, itemName: 'Đèn Beam 230' } }) as never,
    );

    const res = await request(app).get('/api/v1/inventory/item-den').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      itemName: 'Đèn Beam 230',
      quantityTotal: 15,
      quantityDamaged: 1,
      quantityReserved: 2,
      quantityAvailable: 12,
    });
  });

  it('returns 404 when there is no inventory row for the item', async () => {
    mockedRepo.findByItemId.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/inventory/missing').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/inventory/movements', () => {
  it('returns the movement history for an item', async () => {
    mockedRepo.findMovements.mockResolvedValue({ rows: [fakeMovement()], totalItems: 1 } as never);

    const res = await request(app)
      .get('/api/v1/inventory/movements?itemId=item-loa')
      .set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ itemId: 'item-loa', movementType: 'OUTBOUND', quantity: 2 });
  });
});

describe('GET /api/v1/inventory/picklist/:orderId', () => {
  it('returns order items joined with live stock', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'order-1' } as never);
    mockedRepo.findOrderItemsForPicklist.mockResolvedValue([
      {
        orderItemId: 'oi-1',
        itemId: 'item-loa',
        source: 'INTERNAL',
        quantity: 2,
        item: { itemName: 'Loa JBL 1000W', unit: 'Cái', inventory: { quantityAvailable: 8 } },
      },
    ] as never);

    const res = await request(app).get('/api/v1/inventory/picklist/order-1').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ itemName: 'Loa JBL 1000W', quantityOrdered: 2, quantityAvailable: 8 });
  });

  it('returns 404 when the order does not exist', async () => {
    mockedRepo.orderExists.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/inventory/picklist/missing').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(404);
    expect(mockedRepo.findOrderItemsForPicklist).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/inventory/collected-equipment-reports', () => {
  it('lists reports for an order', async () => {
    mockedRepo.findReports.mockResolvedValue({ rows: [fakeReport()], totalItems: 1 } as never);

    const res = await request(app)
      .get('/api/v1/inventory/collected-equipment-reports?orderId=order-1&status=SUBMITTED')
      .set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ orderCode: 'ORD-001', status: 'SUBMITTED', reportedBy: { fullName: 'Team Leader' } });
    expect(res.body.data[0].items).toHaveLength(1);
  });
});

describe('Write endpoints — Admin must get 403 on older endpoints, but allowed on basic operations', () => {
  it('POST /api/v1/inventory/adjust is allowed for ADMIN (returns 400 for bad payload instead of 403)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', authHeader('ADMIN'))
      .send({});
    expect(res.status).toBe(400); // Passed auth, failed validation
  });

  it('POST /api/v1/inventory/reserve is allowed for ADMIN (returns 400 for bad payload instead of 403)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/reserve')
      .set('Authorization', authHeader('ADMIN'))
      .send({});
    expect(res.status).toBe(400); // Passed auth, failed validation
  });

  it('POST /api/v1/inventory/release is allowed for ADMIN (returns 400 for bad payload instead of 403)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/release')
      .set('Authorization', authHeader('ADMIN'))
      .send({});
    expect(res.status).toBe(400); // Passed auth, failed validation
  });

  it('POST /api/v1/inventory/collected-equipment-reports is forbidden for ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader('ADMIN'))
      .send({ orderId: 'order-1', reportType: 'INTERNAL', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });
    expect(res.status).toBe(403);
  });

  it('PUT .../confirm is forbidden for ADMIN', async () => {
    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/any-id/confirm')
      .set('Authorization', authHeader('ADMIN'))
      .send({});
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/inventory is allowed for ADMIN (returns 400 for bad payload instead of 403)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', authHeader('ADMIN'))
      .send({});
    expect(res.status).toBe(400); // Passed auth, failed validation
  });
});

describe('Write endpoints — successful quantity updates (Manager)', () => {
  it('POST /api/v1/inventory/adjust increases quantityTotal and quantityAvailable together (200)', async () => {
    mockedRepo.findByItemId.mockResolvedValue(fakeInventory({ quantityTotal: 50, quantityAvailable: 45, quantityReserved: 5 }) as never);
    mockedRepo.adjustTotal.mockResolvedValue(fakeInventory({ quantityTotal: 60, quantityAvailable: 55, quantityReserved: 5 }) as never);
    mockedRepo.createMovement.mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', authHeader('MANAGER'))
      .send({ itemId: 'item-loa', deltaTotal: 10, notes: 'Nhập thêm hàng test' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ quantityTotal: 60, quantityAvailable: 55 });
    expect(mockedRepo.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-loa', movementType: 'ADJUSTMENT', quantity: 10 }),
    );
  });

  it('POST /api/v1/inventory/reserve moves stock from available to reserved (200)', async () => {
    mockedRepo.findByItemId.mockResolvedValue(fakeInventory({ quantityAvailable: 55, quantityReserved: 5 }) as never);
    mockedRepo.reserve.mockResolvedValue(fakeInventory({ quantityAvailable: 52, quantityReserved: 8 }) as never);

    const res = await request(app)
      .post('/api/v1/inventory/reserve')
      .set('Authorization', authHeader('MANAGER'))
      .send({ itemId: 'item-loa', quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ quantityAvailable: 52, quantityReserved: 8 });
  });

  it('POST /api/v1/inventory/reserve rejects a request exceeding quantityAvailable (400)', async () => {
    mockedRepo.findByItemId.mockResolvedValue(fakeInventory({ quantityAvailable: 55 }) as never);

    const res = await request(app)
      .post('/api/v1/inventory/reserve')
      .set('Authorization', authHeader('MANAGER'))
      .send({ itemId: 'item-loa', quantity: 999999 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Không đủ số lượng khả dụng để giữ chỗ');
    expect(mockedRepo.reserve).not.toHaveBeenCalled();
  });

  it('POST /api/v1/inventory/release moves stock back from reserved to available (200)', async () => {
    mockedRepo.findByItemId.mockResolvedValue(fakeInventory({ quantityAvailable: 52, quantityReserved: 8 }) as never);
    mockedRepo.release.mockResolvedValue(fakeInventory({ quantityAvailable: 55, quantityReserved: 5 }) as never);

    const res = await request(app)
      .post('/api/v1/inventory/release')
      .set('Authorization', authHeader('MANAGER'))
      .send({ itemId: 'item-loa', quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ quantityAvailable: 55, quantityReserved: 5 });
  });

  it('creates a collected-equipment report as STAFF who is the LEAD assignee (201), confirming it as MANAGER applies inventory effects (200)', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'order-1' } as never);
    mockedRepo.itemExists.mockResolvedValue({ itemId: 'item-loa', itemName: 'Loa JBL 1000W' } as never);
    mockedRepo.createReport.mockResolvedValue(fakeReport({ status: 'SUBMITTED' }) as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);

    const createRes = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader('STAFF', 'leader-1'))
      .send({
        orderId: 'order-1',
        reportType: 'INTERNAL',
        notes: 'Thu hồi fixture test',
        items: [{ itemId: 'item-loa', goodQuantity: 2, damagedQuantity: 1, lostQuantity: 0 }],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('SUBMITTED');

    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'SUBMITTED' }) as never);
    mockedRepo.confirmReportAndApplyInventory.mockResolvedValue(
      fakeReport({ status: 'CONFIRMED', confirmedAt: new Date('2026-07-02T00:00:00Z'), confirmer: { userId: 'user-1', fullName: 'Manager' } }) as never,
    );

    const confirmRes = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/report-1/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('CONFIRMED');

    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'CONFIRMED' }) as never);

    const reconfirmRes = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/report-1/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({});
    expect(reconfirmRes.status).toBe(400);
    expect(reconfirmRes.body.error.message).toContain('Chỉ có thể xác nhận báo cáo đang ở trạng thái SUBMITTED');
  });

  it('POST /api/v1/inventory creates the first inventory row for an item that has none yet (201)', async () => {
    mockedRepo.itemExists.mockResolvedValue({ itemId: 'item-new', itemName: 'Fixture Test Item' } as never);
    mockedRepo.findByItemId.mockResolvedValue(null);
    mockedRepo.create.mockResolvedValue(fakeInventory({ itemId: 'item-new', quantityTotal: 20, quantityDamaged: 2, quantityReserved: 0, quantityAvailable: 18 }) as never);

    const res = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', authHeader('MANAGER'))
      .send({ itemId: 'item-new', quantityTotal: 20, quantityDamaged: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ itemId: 'item-new', quantityTotal: 20, quantityDamaged: 2, quantityReserved: 0, quantityAvailable: 18 });
  });

  it('POST /api/v1/inventory returns 409 when an inventory row already exists for the item', async () => {
    mockedRepo.itemExists.mockResolvedValue({ itemId: 'item-loa', itemName: 'Loa JBL 1000W' } as never);
    mockedRepo.findByItemId.mockResolvedValue(fakeInventory() as never);

    const res = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', authHeader('MANAGER'))
      .send({ itemId: 'item-loa', quantityTotal: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Hồ sơ tồn kho cho thiết bị này đã tồn tại');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });
});

describe('/return-reports — alias of /collected-equipment-reports, same underlying data', () => {
  it('GET /api/v1/inventory/return-reports lists the same reports as /collected-equipment-reports', async () => {
    mockedRepo.findReports.mockResolvedValue({ rows: [fakeReport()], totalItems: 1 } as never);

    const res = await request(app)
      .get('/api/v1/inventory/return-reports?orderId=order-1&status=SUBMITTED')
      .set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ orderCode: 'ORD-001', status: 'SUBMITTED' });
  });

  it('creates a report via /return-reports as STAFF who is the LEAD assignee (201) and confirms via /return-reports/:id/confirm as MANAGER (200)', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'order-1' } as never);
    mockedRepo.itemExists.mockResolvedValue({ itemId: 'item-loa', itemName: 'Loa JBL 1000W' } as never);
    mockedRepo.createReport.mockResolvedValue(fakeReport({ reportId: 'report-2', status: 'SUBMITTED' }) as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);

    const createRes = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader('STAFF', 'leader-1'))
      .send({
        orderId: 'order-1',
        reportType: 'INTERNAL',
        notes: 'Thu hồi fixture test qua alias return-reports',
        items: [{ itemId: 'item-loa', goodQuantity: 1, damagedQuantity: 0, lostQuantity: 0 }],
      });

    expect(createRes.status).toBe(201);
    const reportId = createRes.body.data.reportId as string;

    mockedRepo.findReportById.mockResolvedValue(fakeReport({ reportId, status: 'SUBMITTED' }) as never);

    const getRes = await request(app)
      .get(`/api/v1/inventory/return-reports/${reportId}`)
      .set('Authorization', authHeader('MANAGER'));
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.reportId).toBe(reportId);

    mockedRepo.confirmReportAndApplyInventory.mockResolvedValue(fakeReport({ reportId, status: 'CONFIRMED' }) as never);

    const confirmRes = await request(app)
      .put(`/api/v1/inventory/return-reports/${reportId}/confirm`)
      .set('Authorization', authHeader('MANAGER'))
      .send({});
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('CONFIRMED');
  });

  it('POST /api/v1/inventory/return-reports is forbidden for ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader('ADMIN'))
      .send({ orderId: 'order-1', reportType: 'INTERNAL', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });
    expect(res.status).toBe(403);
  });
});
