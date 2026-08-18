import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { scheduleRepository } from '../../operations/schedule.repository';
import { inventoryRepository } from '../inventory.repository';
import { reservationRepository } from '../reservation.repository';

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
    getLockedQuantityByDate: jest.fn(),
    adjustTotal: jest.fn(),
    createMovement: jest.fn(),
    findMovements: jest.fn(),
    getExportedQuantity: jest.fn(),
    findOrderItemsForPicklist: jest.fn(),
    findReports: jest.fn(),
    findReportById: jest.fn(),
    createReport: jest.fn(),
    confirmReportAndApplyInventory: jest.fn(),
    recordFieldOutbound: jest.fn(),
  },
}));

jest.mock('../reservation.repository', () => ({
  reservationRepository: {
    getReservedForRange: jest.fn(),
    getReservedForRangeBatch: jest.fn(),
    getOutstandingOutBatch: jest.fn(),
    getMovementSumsBatch: jest.fn(),
    getOnHandNow: jest.fn(),
    getAvailableForRange: jest.fn(),
    getOutstandingOut: jest.fn(),
    listReservationsForItem: jest.fn(),
    listReservationsInRange: jest.fn(),
    reserveOrderStock: jest.fn(),
    releaseByOrder: jest.fn(),
    consumeByOrder: jest.fn(),
    countActiveByOrder: jest.fn(),
    orderWindow: jest.fn(),
    getRentedByItemForOrder: jest.fn(),
  },
}));

jest.mock('../../operations/schedule.repository', () => ({
  scheduleRepository: {
    isUserLeadOnOrder: jest.fn(),
  },
}));

const mockedRepo = inventoryRepository as jest.Mocked<typeof inventoryRepository>;
const mockedResv = reservationRepository as jest.Mocked<typeof reservationRepository>;

beforeEach(() => {
  // Mặc định "không có hàng đang ngoài kho" → quantityOnHand = total − damaged trong các test hiển thị.
  mockedResv.getOutstandingOut.mockResolvedValue(0);
  // listInventory dùng bản BATCH (chống N+1) — uỷ quyền về scalar mock để các test cũ set getReservedForRange/
  // getOutstandingOut vẫn có hiệu lực mà không phải sửa từng test.
  mockedResv.getReservedForRangeBatch.mockImplementation(async (itemIds: string[]) => {
    const map = new Map<string, number>();
    for (const id of itemIds) map.set(id, (await mockedResv.getReservedForRange(id, new Date(), new Date())) ?? 0);
    return map;
  });
  mockedResv.getOutstandingOutBatch.mockImplementation(async (itemIds: string[]) => {
    const map = new Map<string, number>();
    for (const id of itemIds) map.set(id, (await mockedResv.getOutstandingOut(id)) ?? 0);
    return map;
  });
});
const mockedScheduleRepo = scheduleRepository as jest.Mocked<typeof scheduleRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

// Some UTS spec rows use role names (e.g. "Customer") that don't exist in the real UserRole enum
// (ADMIN/MANAGER/STAFF only — prisma/schema.prisma). requireRole() just checks list membership on
// whatever string is in the JWT, so we can still sign an arbitrary role to exercise the "role not
// allowed" 403 branch without needing authHeader()'s narrower TS type.
function customAuthHeader(role: string, userId = 'user-x') {
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
    evidences: [],
    ...overrides,
  };
}

describe('GET /api/v1/inventory', () => {
  it('lists inventory rows with correct joined fields', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeInventory()], totalItems: 1 } as never);
    mockedResv.getReservedForRange.mockResolvedValue(2);

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
      fakeInventory({ itemId: 'item-den', quantityTotal: 15, quantityDamaged: 1, item: { ...fakeInventory().item, itemName: 'Đèn Beam 230' } }) as never,
    );
    mockedResv.getReservedForRange.mockResolvedValue(2);

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
        item: { itemName: 'Loa JBL 1000W', unit: 'Cái', inventory: { quantityTotal: 10, quantityDamaged: 0 } },
      },
    ] as never);
    mockedResv.getOnHandNow.mockResolvedValue(8);
    mockedRepo.getExportedQuantity.mockResolvedValue(0);
    mockedResv.getRentedByItemForOrder.mockResolvedValue(new Map());

    const res = await request(app).get('/api/v1/inventory/picklist/order-1').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ itemName: 'Loa JBL 1000W', quantityOrdered: 2, quantityAvailable: 8, quantityExported: 0 });
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
    mockedRepo.findByItemId.mockResolvedValue(fakeInventory({ quantityTotal: 50 }) as never);
    mockedRepo.adjustTotal.mockResolvedValue(fakeInventory({ quantityTotal: 60 }) as never);
    mockedResv.getOnHandNow.mockResolvedValue(50);
    mockedResv.getReservedForRange.mockResolvedValue(5);
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

// ============================================================================
// UTS spec coverage (Report5.1_Unit Test.xlsx) — sheets: View Inventory, Update Inventory,
// Generate Pick List, Confirm Inventory Return, Record Collected Equipment Report, Confirm Collected
// Equipment Report, Record Collected Supplier Equipment.
//
// "Check Inventory Availability" (POST body { start, end, items }) and "View Audit Logs" have no
// matching route anywhere in this backend (grepped routes.ts, every *.routes.ts, prisma/schema.prisma —
// no audit_log table/route, no availability-check endpoint) — skipped rather than inventing routes.
//
// The 4 "collection/return" sheets share only 2 real write actions (createReport / confirmReport)
// exposed under 2 URL aliases (/collected-equipment-reports and /return-reports, same controller — see
// comment in inventory.routes.ts). Resolution used below:
//   - Record Collected Equipment Report  -> POST /collected-equipment-reports, reportType: INTERNAL
//   - Confirm Collected Equipment Report -> PUT  /collected-equipment-reports/:reportId/confirm
//   - Record Collected Supplier Equipment -> POST /return-reports, reportType: SUPPLIER
//   - Confirm Inventory Return           -> PUT  /return-reports/:reportId/confirm
// ============================================================================

describe('GET /api/v1/inventory — View Inventory UTCID coverage', () => {
  // UTCID01: no auth -> 401
  it('UTCID01: no Authorization header returns 401', async () => {
    const res = await request(app).get('/api/v1/inventory');
    expect(res.status).toBe(401);
  });

  // UTCID02: doc expects 403 for STAFF ("yêu cầu Admin"), but GET /inventory has no requireRole
  // middleware at all (router.get('/', validate(...), asyncHandler(list))) — every authenticated role
  // can read. Documented-vs-actual: actual is 200.
  it('UTCID02: STAFF role is actually allowed to list inventory (route has no role restriction, unlike the spec\'s Admin-only expectation)', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeInventory()], totalItems: 1 } as never);
    mockedResv.getReservedForRange.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/inventory').set('Authorization', authHeader('STAFF'));

    expect(res.status).toBe(200);
  });

  // UTCID03: invalid date query -> z.coerce.date() rejects 'abc-xyz' -> 400
  it('UTCID03: invalid date query param returns 400', async () => {
    const res = await request(app).get('/api/v1/inventory?date=abc-xyz').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(400);
  });

  // UTCID04: repository failure -> 500
  it('UTCID04: repository failure surfaces as 500', async () => {
    mockedRepo.findMany.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app).get('/api/v1/inventory').set('Authorization', authHeader('ADMIN'));

    expect(res.status).toBe(500);
  });

  // UTCID05: search + category filter -> 200 (unknown `category` param is silently ignored by the query schema)
  it('UTCID05: search filter returns 200', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeInventory()], totalItems: 1 } as never);
    mockedResv.getReservedForRange.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/inventory?search=MaAo123&category=KhoAo')
      .set('Authorization', authHeader('ADMIN'));

    expect(res.status).toBe(200);
  });

  // UTCID06: is_low_stock (unknown param, ignored) + valid date filter -> 200
  it('UTCID06: is_low_stock and date filters return 200', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeInventory()], totalItems: 1 } as never);
    mockedResv.getReservedForRange.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/inventory?is_low_stock=true&date=2026-06-15')
      .set('Authorization', authHeader('ADMIN'));

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/inventory/adjust — Update Inventory UTCID coverage', () => {
  // UTCID01: no auth -> 401
  it('UTCID01: no Authorization header returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .send({ itemId: 'ITM123', deltaTotal: 10, notes: 'Nhập hàng mới' });

    expect(res.status).toBe(401);
  });

  // UTCID02: doc expects 403 for MANAGER ("yêu cầu Admin"), but /adjust explicitly allows
  // MANAGER + ADMIN (routes.ts comment: "CẬP NHẬT: Hiện đã cấp quyền ADMIN cho các thao tác /adjust" —
  // Manager already had write access; only Admin was newly granted). Documented-vs-actual: actual 200.
  it('UTCID02: MANAGER is actually allowed on /adjust (spec expected Admin-only, but Manager already had write access)', async () => {
    mockedRepo.findByItemId.mockResolvedValue(fakeInventory({ quantityTotal: 50 }) as never);
    mockedRepo.adjustTotal.mockResolvedValue(fakeInventory({ quantityTotal: 60 }) as never);
    mockedResv.getOnHandNow.mockResolvedValue(50);
    mockedResv.getReservedForRange.mockResolvedValue(0);
    mockedRepo.createMovement.mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', authHeader('MANAGER'))
      .send({ itemId: 'ITM123', deltaTotal: 10, notes: 'Nhập hàng' });

    expect(res.status).toBe(200);
  });

  // UTCID03: item has no inventory row -> 404
  it('UTCID03: unknown item returns 404', async () => {
    mockedRepo.findByItemId.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', authHeader('ADMIN'))
      .send({ itemId: 'NON_EXISTENT', deltaTotal: 10, notes: 'Nhập hàng' });

    expect(res.status).toBe(404);
  });

  // UTCID04: deltaTotal of 0 is rejected by validation ("Số lượng điều chỉnh không được bằng 0") -> 400
  it('UTCID04: deltaTotal of 0 fails validation with 400', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', authHeader('ADMIN'))
      .send({ itemId: 'ITM123', deltaTotal: 0, notes: '' });

    expect(res.status).toBe(400);
  });

  // UTCID05: repository failure -> 500
  it('UTCID05: repository failure surfaces as 500', async () => {
    mockedRepo.findByItemId.mockResolvedValue(fakeInventory() as never);
    mockedResv.getOnHandNow.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', authHeader('ADMIN'))
      .send({ itemId: 'ITM123', deltaTotal: 10, notes: 'Nhập hàng' });

    expect(res.status).toBe(500);
  });

  // UTCID06: valid adjustment -> 200
  it('UTCID06: valid adjustment succeeds with 200', async () => {
    mockedRepo.findByItemId.mockResolvedValue(fakeInventory({ quantityTotal: 50 }) as never);
    mockedRepo.adjustTotal.mockResolvedValue(fakeInventory({ quantityTotal: 60 }) as never);
    mockedResv.getOnHandNow.mockResolvedValue(50);
    mockedResv.getReservedForRange.mockResolvedValue(5);
    mockedRepo.createMovement.mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', authHeader('ADMIN'))
      .send({ itemId: 'ITM123', deltaTotal: 10, notes: 'Nhập hàng mới' });

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/inventory/picklist/:orderId — Generate Pick List UTCID coverage', () => {
  // UTCID01: no auth -> 401
  it('UTCID01: no Authorization header returns 401', async () => {
    const res = await request(app).get('/api/v1/inventory/picklist/ORD123');
    expect(res.status).toBe(401);
  });

  // UTCID02: doc expects 403 for STAFF ("yêu cầu Manager"), but the picklist route has no requireRole
  // middleware at all — every authenticated role can call it. Documented-vs-actual: actual 200.
  it('UTCID02: STAFF is actually allowed (route has no role restriction, unlike the spec\'s Manager-only expectation)', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ORD123' } as never);
    mockedRepo.findOrderItemsForPicklist.mockResolvedValue([]);
    mockedResv.getRentedByItemForOrder.mockResolvedValue(new Map());

    const res = await request(app).get('/api/v1/inventory/picklist/ORD123').set('Authorization', authHeader('STAFF'));

    expect(res.status).toBe(200);
  });

  // UTCID03: unknown order -> 404
  it('UTCID03: unknown order returns 404', async () => {
    mockedRepo.orderExists.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/inventory/picklist/NON_EXISTENT').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(404);
    expect(mockedRepo.findOrderItemsForPicklist).not.toHaveBeenCalled();
  });

  // UTCID04: doc expects 400 for a "draft" order ("chỉ tạo được cho đơn đã xác nhận"), but getPicklist
  // never checks order status — only orderExists. Documented-vs-actual: actual 200.
  it('UTCID04: a non-confirmed ("draft") order still returns 200 — backend never checks order status here', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ORD_DRAFT' } as never);
    mockedRepo.findOrderItemsForPicklist.mockResolvedValue([
      {
        orderItemId: 'oi-1',
        itemId: 'item-loa',
        source: 'INTERNAL',
        quantity: 2,
        item: { itemName: 'Loa JBL 1000W', unit: 'Cái', rentalPrice: 500000, inventory: { quantityTotal: 10, quantityDamaged: 0 } },
      },
    ] as never);
    mockedResv.getOnHandNow.mockResolvedValue(8);
    mockedRepo.getExportedQuantity.mockResolvedValue(0);
    mockedResv.getRentedByItemForOrder.mockResolvedValue(new Map());

    const res = await request(app).get('/api/v1/inventory/picklist/ORD_DRAFT').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
  });

  // UTCID05: doc expects 400 for an order with no items ("không có thiết bị nào cần xuất kho"), but the
  // backend just returns an empty list. Documented-vs-actual: actual 200.
  it('UTCID05: an order with no items still returns 200 with an empty list', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ORD_NO_ITEMS' } as never);
    mockedRepo.findOrderItemsForPicklist.mockResolvedValue([]);
    mockedResv.getRentedByItemForOrder.mockResolvedValue(new Map());

    const res = await request(app).get('/api/v1/inventory/picklist/ORD_NO_ITEMS').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  // UTCID06: repository failure -> 500
  it('UTCID06: repository failure surfaces as 500', async () => {
    mockedRepo.orderExists.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app).get('/api/v1/inventory/picklist/ORD123').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(500);
  });

  // UTCID07: happy path -> 200
  it('UTCID07: valid order returns the picklist with 200', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ORD123' } as never);
    mockedRepo.findOrderItemsForPicklist.mockResolvedValue([
      {
        orderItemId: 'oi-1',
        itemId: 'item-loa',
        source: 'INTERNAL',
        quantity: 2,
        item: { itemName: 'Loa JBL 1000W', unit: 'Cái', rentalPrice: 500000, inventory: { quantityTotal: 10, quantityDamaged: 0 } },
      },
    ] as never);
    mockedResv.getOnHandNow.mockResolvedValue(8);
    mockedRepo.getExportedQuantity.mockResolvedValue(0);
    mockedResv.getRentedByItemForOrder.mockResolvedValue(new Map());

    const res = await request(app).get('/api/v1/inventory/picklist/ORD123').set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ itemName: 'Loa JBL 1000W', quantityOrdered: 2 });
  });
});

describe('PUT /api/v1/inventory/return-reports/:reportId/confirm — Confirm Inventory Return UTCID coverage', () => {
  // UTCID01: no auth -> 401
  it('UTCID01: no Authorization header returns 401', async () => {
    const res = await request(app).put('/api/v1/inventory/return-reports/T1/confirm').send({});
    expect(res.status).toBe(401);
  });

  // UTCID02: role outside MANAGER/STAFF (e.g. Customer, which isn't even a real UserRole) -> 403
  it('UTCID02: a role outside MANAGER/STAFF (e.g. Customer) is forbidden with 403', async () => {
    const res = await request(app)
      .put('/api/v1/inventory/return-reports/T1/confirm')
      .set('Authorization', customAuthHeader('CUSTOMER'))
      .send({});

    expect(res.status).toBe(403);
  });

  // UTCID03: unknown task/report -> 404
  it('UTCID03: unknown report returns 404', async () => {
    mockedRepo.findReportById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/inventory/return-reports/NON_EXISTENT/confirm')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({});

    expect(res.status).toBe(404);
  });

  // UTCID04: STAFF who is not the LEAD assignee on the report's order -> 403 ("not your task")
  it('UTCID04: STAFF who is not the LEAD assignee is forbidden with 403', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'SUBMITTED', orderId: 'order-other' }) as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(false);

    const res = await request(app)
      .put('/api/v1/inventory/return-reports/T_OTHER/confirm')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({});

    expect(res.status).toBe(403);
  });

  // UTCID05: report already confirmed (not in a confirmable state) -> 400
  it('UTCID05: a report that is not in SUBMITTED status returns 400', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'CONFIRMED' }) as never);

    const res = await request(app)
      .put('/api/v1/inventory/return-reports/T_NOT_COLLECTED_YET/confirm')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({});

    expect(res.status).toBe(400);
  });

  // UTCID06: doc expects 400 for returned_qty > collected_qty, but confirmReportBodySchema only has an
  // optional `notes` field — there is no such quantity-comparison validation anywhere in confirmReport.
  // Documented-vs-actual: extra keys are silently stripped and the confirm proceeds normally -> 200.
  it('UTCID06: confirmReportBodySchema has no qty fields — an oversized returned_qty payload still succeeds (200)', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'SUBMITTED', orderId: 'order-1' }) as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedRepo.confirmReportAndApplyInventory.mockResolvedValue(fakeReport({ status: 'CONFIRMED' }) as never);

    const res = await request(app)
      .put('/api/v1/inventory/return-reports/T1/confirm')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ returned_qty: 12, collected_qty: 10 });

    expect(res.status).toBe(200);
  });

  // UTCID07: notes: null is rejected by Zod (optional string accepts undefined, not null) -> 400.
  // (Documented reason was "evidence required when damaged in transit" — the real 400 comes from the
  // schema rejecting a null notes value, not a business-rule check, but the resulting status matches.)
  it('UTCID07: notes: null fails validation with 400', async () => {
    const res = await request(app)
      .put('/api/v1/inventory/return-reports/T1/confirm')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ condition: 'DAMAGED_IN_TRANSIT', notes: null });

    expect(res.status).toBe(400);
  });

  // UTCID08: repository failure -> 500
  it('UTCID08: repository failure surfaces as 500', async () => {
    mockedRepo.findReportById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .put('/api/v1/inventory/return-reports/T1/confirm')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({});

    expect(res.status).toBe(500);
  });

  // UTCID09: valid confirm by the LEAD staff -> 200
  it('UTCID09: valid confirm by the LEAD staff succeeds with 200', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'SUBMITTED', orderId: 'order-1' }) as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedRepo.confirmReportAndApplyInventory.mockResolvedValue(fakeReport({ status: 'CONFIRMED' }) as never);

    const res = await request(app)
      .put('/api/v1/inventory/return-reports/T1/confirm')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ condition: 'GOOD', returned_qty: 10 });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/inventory/collected-equipment-reports — Record Collected Equipment Report UTCID coverage', () => {
  // UTCID01: no auth -> 401
  it('UTCID01: no Authorization header returns 401', async () => {
    const res = await request(app).post('/api/v1/inventory/collected-equipment-reports').send({});
    expect(res.status).toBe(401);
  });

  // UTCID02: role outside STAFF (e.g. Customer) -> 403
  it('UTCID02: a role outside STAFF (e.g. Customer) is forbidden with 403', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', customAuthHeader('CUSTOMER'))
      .send({ orderId: 'order-1', reportType: 'INTERNAL', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(403);
  });

  // UTCID03: unknown order/task -> 404
  it('UTCID03: unknown order returns 404', async () => {
    mockedRepo.orderExists.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'NON_EXISTENT', reportType: 'INTERNAL', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(404);
  });

  // UTCID04: STAFF who is not the LEAD assignee on the order -> 403
  it('UTCID04: STAFF who is not the LEAD assignee is forbidden with 403', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'order-other' } as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-other', reportType: 'INTERNAL', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(403);
  });

  // UTCID05: doc expects 400 for an order whose equipment hasn't been delivered yet, but createReport
  // never checks order/delivery status (only orderExists + LEAD check + item existence).
  // Documented-vs-actual: actual 201.
  it('UTCID05: createReport has no delivery-status guard — a "not yet delivered" order still succeeds with 201', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'order-1' } as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedRepo.itemExists.mockResolvedValue({ itemId: 'item-loa', itemName: 'Loa JBL 1000W' } as never);
    mockedRepo.createReport.mockResolvedValue(fakeReport({ status: 'SUBMITTED' }) as never);

    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-1', reportType: 'INTERNAL', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(201);
  });

  // UTCID06: doc's oversized-quantity payload has no `items` array — Zod rejects with 400 (there is no
  // separate collected+missing-vs-delivered cross-check anywhere in the backend).
  it('UTCID06: a body without a valid items array fails validation with 400', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ collected_qty: 10, missing_qty: 5, total_qty: 10 });

    expect(res.status).toBe(400);
  });

  // UTCID07: notes: null is rejected by Zod (optional string accepts undefined, not null) -> 400
  it('UTCID07: notes: null fails validation with 400', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-1', reportType: 'INTERNAL', notes: null, items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(400);
  });

  // UTCID08: repository failure -> 500
  it('UTCID08: repository failure surfaces as 500', async () => {
    mockedRepo.orderExists.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-1', reportType: 'INTERNAL', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(500);
  });

  // UTCID09: doc expects 200, but POST create returns 201 Created (created() helper in the controller).
  // Documented-vs-actual: actual status is 201.
  it('UTCID09: valid submission succeeds — actual status is 201 Created, not the 200 the spec expected', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'order-1' } as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedRepo.itemExists.mockResolvedValue({ itemId: 'item-loa', itemName: 'Loa JBL 1000W' } as never);
    mockedRepo.createReport.mockResolvedValue(fakeReport({ status: 'SUBMITTED' }) as never);

    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-1', reportType: 'INTERNAL', items: [{ itemId: 'item-loa', goodQuantity: 10 }] });

    expect(res.status).toBe(201);
  });
});

describe('PUT /api/v1/inventory/collected-equipment-reports/:reportId/confirm — Confirm Collected Equipment Report UTCID coverage', () => {
  // UTCID01: no auth -> 401
  it('UTCID01: no Authorization header returns 401', async () => {
    const res = await request(app).put('/api/v1/inventory/collected-equipment-reports/R1/confirm').send({});
    expect(res.status).toBe(401);
  });

  // UTCID02: doc expects 403 for STAFF via the role gate ("yêu cầu Manager/Admin/Warehouse Keeper"), but
  // the real route allows STAFF through requireRole('MANAGER','STAFF'). A non-lead STAFF is instead
  // rejected one level down, inside confirmReport's isLead check — different code path, same 403 status.
  it('UTCID02: STAFF who is not the LEAD assignee still ends up 403 (via the isLead check, not the role gate the spec assumed)', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'SUBMITTED', orderId: 'order-1' }) as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(false);

    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/R2/confirm')
      .set('Authorization', authHeader('STAFF', 'staff-x'))
      .send({});

    expect(res.status).toBe(403);
  });

  // UTCID03: unknown report -> 404
  it('UTCID03: unknown report returns 404', async () => {
    mockedRepo.findReportById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/NON_EXISTENT/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({});

    expect(res.status).toBe(404);
  });

  // UTCID04: report already confirmed -> 400
  it('UTCID04: an already-confirmed report returns 400', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'CONFIRMED' }) as never);

    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/R_CONFIRMED/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({});

    expect(res.status).toBe(400);
  });

  // UTCID05: doc expects a distinct "rejected/cancelled" 400, but CollectedEquipmentReportStatus only
  // has SUBMITTED/CONFIRMED (inventory.validators.ts reportStatusEnum) — there is no REJECTED/CANCELLED
  // state in this backend. Any non-SUBMITTED status hits the same 400 branch as UTCID04.
  it('UTCID05: backend has no REJECTED/CANCELLED status — a non-SUBMITTED report still returns 400 via the same branch as UTCID04', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'CONFIRMED' }) as never);

    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/R_REJECTED/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({});

    expect(res.status).toBe(400);
  });

  // UTCID06: doc expects 400 for a missing `decision`, but confirmReportBodySchema has no `decision`
  // field at all (only optional `notes`) — the extra key is silently stripped and confirm proceeds
  // normally. Documented-vs-actual: actual 200.
  it('UTCID06: body without a recognized decision field still succeeds — backend has no decision/reject concept', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'SUBMITTED', orderId: 'order-1' }) as never);
    mockedRepo.confirmReportAndApplyInventory.mockResolvedValue(fakeReport({ status: 'CONFIRMED' }) as never);

    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/R6/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ decision: null });

    expect(res.status).toBe(200);
  });

  // UTCID07: doc expects 400 when rejecting without a reason, but there is no REJECT flow at all —
  // confirmReport unconditionally confirms. Documented-vs-actual: actual 200.
  it('UTCID07: there is no REJECT decision path — sending decision: REJECT still confirms the report (200)', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'SUBMITTED', orderId: 'order-1' }) as never);
    mockedRepo.confirmReportAndApplyInventory.mockResolvedValue(fakeReport({ status: 'CONFIRMED' }) as never);

    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/R7/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ decision: 'REJECT', reason: '' });

    expect(res.status).toBe(200);
  });

  // UTCID08: repository failure -> 500
  it('UTCID08: repository failure surfaces as 500', async () => {
    mockedRepo.findReportById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/R1/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({});

    expect(res.status).toBe(500);
  });

  // UTCID09: valid confirm decision -> 200
  it('UTCID09: valid confirm decision succeeds with 200', async () => {
    mockedRepo.findReportById.mockResolvedValue(fakeReport({ status: 'SUBMITTED', orderId: 'order-1' }) as never);
    mockedRepo.confirmReportAndApplyInventory.mockResolvedValue(fakeReport({ status: 'CONFIRMED' }) as never);

    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/R9/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ decision: 'CONFIRM' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/inventory/return-reports — Record Collected Supplier Equipment UTCID coverage', () => {
  // UTCID01: no auth -> 401
  it('UTCID01: no Authorization header returns 401', async () => {
    const res = await request(app).post('/api/v1/inventory/return-reports').send({});
    expect(res.status).toBe(401);
  });

  // UTCID02: role outside STAFF (e.g. Customer) -> 403
  it('UTCID02: a role outside STAFF (e.g. Customer) is forbidden with 403', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', customAuthHeader('CUSTOMER'))
      .send({ orderId: 'order-1', reportType: 'SUPPLIER', transactionId: 'trans-1', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(403);
  });

  // UTCID03: unknown order/task -> 404
  it('UTCID03: unknown order returns 404', async () => {
    mockedRepo.orderExists.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'NON_EXISTENT', reportType: 'SUPPLIER', transactionId: 'trans-1', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(404);
  });

  // UTCID04: STAFF who is not the LEAD assignee on the order -> 403
  it('UTCID04: STAFF who is not the LEAD assignee is forbidden with 403', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'order-other' } as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-other', reportType: 'SUPPLIER', transactionId: 'trans-1', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(403);
  });

  // UTCID05: doc expects 400 for supplier equipment "not yet received", but createReport has no such
  // status guard (same gap as the /collected-equipment-reports twin). Documented-vs-actual: actual 201.
  it('UTCID05: createReport has no receipt-status guard — succeeds with 201 regardless', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'order-1' } as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedRepo.itemExists.mockResolvedValue({ itemId: 'item-loa', itemName: 'Loa JBL 1000W' } as never);
    mockedRepo.createReport.mockResolvedValue(fakeReport({ status: 'SUBMITTED', reportType: 'SUPPLIER' }) as never);

    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-1', reportType: 'SUPPLIER', transactionId: 'trans-1', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(201);
  });

  // UTCID06: no `items` array in the body -> Zod validation 400 (no separate total_rented cross-check exists)
  it('UTCID06: a body without a valid items array fails validation with 400', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ collected_qty: 10, missing_qty: 5, total_rented: 10 });

    expect(res.status).toBe(400);
  });

  // UTCID07: notes: null fails Zod validation (optional string doesn't accept null) -> 400
  it('UTCID07: notes: null fails validation with 400', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-1', reportType: 'SUPPLIER', notes: null, items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(400);
  });

  // UTCID08: repository failure -> 500
  it('UTCID08: repository failure surfaces as 500', async () => {
    mockedRepo.orderExists.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-1', reportType: 'SUPPLIER', items: [{ itemId: 'item-loa', goodQuantity: 1 }] });

    expect(res.status).toBe(500);
  });

  // UTCID09: doc expects 200, but POST create returns 201 Created. Documented-vs-actual: actual 201.
  it('UTCID09: valid submission succeeds — actual status is 201 Created, not the 200 the spec expected', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'order-1' } as never);
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedRepo.itemExists.mockResolvedValue({ itemId: 'item-loa', itemName: 'Loa JBL 1000W' } as never);
    mockedRepo.createReport.mockResolvedValue(fakeReport({ status: 'SUBMITTED', reportType: 'SUPPLIER' }) as never);

    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ orderId: 'order-1', reportType: 'SUPPLIER', transactionId: 'trans-1', items: [{ itemId: 'item-loa', goodQuantity: 10 }] });

    expect(res.status).toBe(201);
  });
});
