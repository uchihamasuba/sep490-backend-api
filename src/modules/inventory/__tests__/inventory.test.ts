import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';

// Integration test THẬT — không mock repository, chạy trực tiếp trên DB đã seed (prisma/seed.ts) theo
// đúng yêu cầu "test query trên bộ Seed Data hoàn chỉnh". Test đọc dùng lại dữ liệu seed có sẵn (không
// mutate); test ghi tạo riêng 1 item/inventory rác trong beforeAll và dọn ở afterAll để chạy lại nhiều
// lần vẫn idempotent, không phụ thuộc phải re-seed giữa các lần chạy.
jest.setTimeout(30000);

const prisma = new PrismaClient();

function authHeader(userId: string, role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

let managerId: string;
let adminId: string;
let leaderId: string;
let loaItemId: string;
let denItemId: string;
let order1Id: string;
let fixtureItemId: string;
let fixtureItemNoInventoryId: string;
const createdReportIds: string[] = [];

beforeAll(async () => {
  const [manager, admin, leader, loa, den, order] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { username: 'manager' } }),
    prisma.user.findUniqueOrThrow({ where: { username: 'admin' } }),
    prisma.user.findUniqueOrThrow({ where: { username: 'leader' } }),
    prisma.item.findFirstOrThrow({ where: { itemName: 'Loa JBL 1000W' } }),
    prisma.item.findFirstOrThrow({ where: { itemName: 'Đèn Beam 230' } }),
    prisma.order.findUniqueOrThrow({ where: { orderCode: 'ORD-001' } }),
  ]);
  managerId = manager.userId;
  adminId = admin.userId;
  leaderId = leader.userId;
  loaItemId = loa.itemId;
  denItemId = den.itemId;
  order1Id = order.orderId;

  // Fixture riêng cho các test ghi/mutate — cùng type/category với Loa để không phải tạo lại catalog.
  const loaWithType = await prisma.item.findUniqueOrThrow({ where: { itemId: loaItemId }, select: { typeId: true } });
  const fixtureItem = await prisma.item.create({
    data: {
      itemId: randomUUID(),
      itemCode: `ITM-TEST-${Date.now()}`,
      itemName: 'Fixture Test Item',
      typeId: loaWithType.typeId,
      unit: 'Cái',
      rentalPrice: 100000,
    },
  });
  fixtureItemId = fixtureItem.itemId;
  await prisma.inventory.create({
    data: { inventoryId: randomUUID(), itemId: fixtureItemId, quantityTotal: 50, quantityDamaged: 0, quantityReserved: 5, quantityAvailable: 45 },
  });

  // Fixture RIÊNG, cố tình KHÔNG tạo sẵn dòng inventory — dùng cho test POST /api/v1/inventory (khởi
  // tạo tồn kho lần đầu, xem inventory.service.ts#createInventory).
  const fixtureItemNoInventory = await prisma.item.create({
    data: {
      itemId: randomUUID(),
      itemCode: `ITM-TEST-NOINV-${Date.now()}`,
      itemName: 'Fixture Test Item (no inventory yet)',
      typeId: loaWithType.typeId,
      unit: 'Cái',
      rentalPrice: 100000,
    },
  });
  fixtureItemNoInventoryId = fixtureItemNoInventory.itemId;
});

afterAll(async () => {
  // Xoá CollectedEquipmentReport tạo ra trong test TRƯỚC (report.items/report.movements cascade theo
  // report_id — xem onDelete: Cascade/SetNull ở schema.prisma) — thiếu bước này sẽ để lại report rác
  // gắn vĩnh viễn vào order ORD-001 thật (đã từng xảy ra, xem ghi chú tại describe cuối file).
  for (const reportId of createdReportIds) {
    await prisma.collectedEquipmentReport.delete({ where: { reportId } }).catch(() => undefined);
  }
  await prisma.inventoryMovement.deleteMany({ where: { itemId: fixtureItemId } });
  await prisma.collectedEquipmentReportItem.deleteMany({ where: { itemId: fixtureItemId } });
  await prisma.inventory.deleteMany({ where: { itemId: fixtureItemId } });
  await prisma.item.delete({ where: { itemId: fixtureItemId } });
  await prisma.inventory.deleteMany({ where: { itemId: fixtureItemNoInventoryId } });
  await prisma.item.delete({ where: { itemId: fixtureItemNoInventoryId } });
  await prisma.$disconnect();
});

describe('GET endpoints — queried against real seed data', () => {
  it('GET /api/v1/inventory lists the seeded inventory rows with correct joined fields', async () => {
    const res = await request(app).get('/api/v1/inventory?limit=50').set('Authorization', authHeader(managerId, 'MANAGER'));

    expect(res.status).toBe(200);
    const loaRow = res.body.data.find((r: { itemId: string }) => r.itemId === loaItemId);
    expect(loaRow).toMatchObject({
      itemName: 'Loa JBL 1000W',
      categoryName: 'Âm thanh',
      quantityTotal: 10,
      quantityReserved: 2,
      quantityAvailable: 8,
      quantityDamaged: 0,
    });
  });

  it('GET /api/v1/inventory/:itemId returns the exact seeded row for Đèn Beam 230', async () => {
    const res = await request(app).get(`/api/v1/inventory/${denItemId}`).set('Authorization', authHeader(managerId, 'MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      itemName: 'Đèn Beam 230',
      quantityTotal: 15,
      quantityDamaged: 1,
      quantityReserved: 2,
      quantityAvailable: 12,
    });
  });

  it('GET /api/v1/inventory/movements returns the seeded OUTBOUND/ADJUSTMENT history', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/movements?itemId=${loaItemId}`)
      .set('Authorization', authHeader(managerId, 'MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toMatchObject({ itemId: loaItemId, movementType: 'OUTBOUND', quantity: 2 });
  });

  it('GET /api/v1/inventory/picklist/:orderId returns ORD-001 order items joined with live stock', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/picklist/${order1Id}`)
      .set('Authorization', authHeader(managerId, 'MANAGER'));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const loaLine = res.body.data.find((l: { itemId: string }) => l.itemId === loaItemId);
    expect(loaLine).toMatchObject({ itemName: 'Loa JBL 1000W', quantityOrdered: 2, quantityAvailable: 8 });
  });

  it('GET /api/v1/inventory/collected-equipment-reports lists the seeded SUBMITTED report for ORD-001', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/collected-equipment-reports?orderId=${order1Id}&status=SUBMITTED`)
      .set('Authorization', authHeader(managerId, 'MANAGER'));

    expect(res.status).toBe(200);
    // Không assert độ dài tuyệt đối — chỉ định vị đúng bản ghi seed gốc qua notes, để không vỡ nếu có
    // report khác (vd từ test ghi ở describe dưới) cũng đang tồn tại cho cùng order.
    const seededReport = res.body.data.find(
      (r: { notes: string }) => r.notes === 'Thu hồi thiết bị sau sự kiện Tech Summit 2026',
    );
    expect(seededReport).toMatchObject({ orderCode: 'ORD-001', status: 'SUBMITTED', reportedBy: { fullName: 'Team Leader' } });
    expect(seededReport.items).toHaveLength(2);
  });
});

describe('Write endpoints — Admin must get 403 (read-only role, backend-enforced)', () => {
  it('POST /api/v1/inventory/adjust is forbidden for ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', authHeader(adminId, 'ADMIN'))
      .send({ itemId: fixtureItemId, deltaTotal: 5 });
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/inventory/reserve is forbidden for ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/reserve')
      .set('Authorization', authHeader(adminId, 'ADMIN'))
      .send({ itemId: fixtureItemId, quantity: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/inventory/collected-equipment-reports is forbidden for ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader(adminId, 'ADMIN'))
      .send({ orderId: order1Id, reportType: 'INTERNAL', items: [{ itemId: fixtureItemId, goodQuantity: 1 }] });
    expect(res.status).toBe(403);
  });

  it('PUT .../confirm is forbidden for ADMIN', async () => {
    const res = await request(app)
      .put('/api/v1/inventory/collected-equipment-reports/any-id/confirm')
      .set('Authorization', authHeader(adminId, 'ADMIN'))
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('Write endpoints — successful quantity updates (Manager), against a throwaway fixture item', () => {
  it('POST /api/v1/inventory/adjust increases quantityTotal and quantityAvailable together (200)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', authHeader(managerId, 'MANAGER'))
      .send({ itemId: fixtureItemId, deltaTotal: 10, notes: 'Nhập thêm hàng test' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ quantityTotal: 60, quantityAvailable: 55 });
  });

  it('POST /api/v1/inventory/reserve moves stock from available to reserved (200)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/reserve')
      .set('Authorization', authHeader(managerId, 'MANAGER'))
      .send({ itemId: fixtureItemId, quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ quantityAvailable: 52, quantityReserved: 8 });
  });

  it('POST /api/v1/inventory/reserve rejects a request exceeding quantityAvailable (400)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/reserve')
      .set('Authorization', authHeader(managerId, 'MANAGER'))
      .send({ itemId: fixtureItemId, quantity: 999999 });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/inventory/release moves stock back from reserved to available (200)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/release')
      .set('Authorization', authHeader(managerId, 'MANAGER'))
      .send({ itemId: fixtureItemId, quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ quantityAvailable: 55, quantityReserved: 5 });
  });

  it('creates a collected-equipment report as LEADER (201), confirming it as MANAGER applies inventory effects (200)', async () => {
    const createRes = await request(app)
      .post('/api/v1/inventory/collected-equipment-reports')
      .set('Authorization', authHeader(leaderId, 'LEADER'))
      .send({
        orderId: order1Id,
        reportType: 'INTERNAL',
        notes: 'Thu hồi fixture test',
        items: [{ itemId: fixtureItemId, goodQuantity: 2, damagedQuantity: 1, lostQuantity: 0 }],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('SUBMITTED');
    const reportId = createRes.body.data.reportId as string;
    createdReportIds.push(reportId);

    const confirmRes = await request(app)
      .put(`/api/v1/inventory/collected-equipment-reports/${reportId}/confirm`)
      .set('Authorization', authHeader(managerId, 'MANAGER'))
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('CONFIRMED');

    // available 55 + 2 (good) = 57 ; damaged 0 + 1 = 1
    const invRes = await request(app)
      .get(`/api/v1/inventory/${fixtureItemId}`)
      .set('Authorization', authHeader(managerId, 'MANAGER'));
    expect(invRes.body.data).toMatchObject({ quantityAvailable: 57, quantityDamaged: 1 });

    const reconfirmRes = await request(app)
      .put(`/api/v1/inventory/collected-equipment-reports/${reportId}/confirm`)
      .set('Authorization', authHeader(managerId, 'MANAGER'))
      .send({});
    expect(reconfirmRes.status).toBe(400);
  });

  it('POST /api/v1/inventory creates the first inventory row for an item that has none yet (201)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', authHeader(managerId, 'MANAGER'))
      .send({ itemId: fixtureItemNoInventoryId, quantityTotal: 20, quantityDamaged: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ itemId: fixtureItemNoInventoryId, quantityTotal: 20, quantityDamaged: 2, quantityReserved: 0, quantityAvailable: 18 });
  });

  it('POST /api/v1/inventory returns 409 when an inventory row already exists for the item', async () => {
    const res = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', authHeader(managerId, 'MANAGER'))
      .send({ itemId: fixtureItemId, quantityTotal: 5 });

    expect(res.status).toBe(409);
  });

  it('POST /api/v1/inventory is forbidden for ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', authHeader(adminId, 'ADMIN'))
      .send({ itemId: fixtureItemNoInventoryId, quantityTotal: 5 });
    expect(res.status).toBe(403);
  });
});

describe('/return-reports — alias of /collected-equipment-reports, same underlying data', () => {
  it('GET /api/v1/inventory/return-reports lists the same seeded report as /collected-equipment-reports', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/return-reports?orderId=${order1Id}&status=SUBMITTED`)
      .set('Authorization', authHeader(managerId, 'MANAGER'));

    expect(res.status).toBe(200);
    const seededReport = res.body.data.find(
      (r: { notes: string }) => r.notes === 'Thu hồi thiết bị sau sự kiện Tech Summit 2026',
    );
    expect(seededReport).toMatchObject({ orderCode: 'ORD-001', status: 'SUBMITTED' });
  });

  it('creates a report via /return-reports as LEADER (201) and confirms via /return-reports/:id/confirm as MANAGER (200)', async () => {
    const createRes = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader(leaderId, 'LEADER'))
      .send({
        orderId: order1Id,
        reportType: 'INTERNAL',
        notes: 'Thu hồi fixture test qua alias return-reports',
        items: [{ itemId: fixtureItemId, goodQuantity: 1, damagedQuantity: 0, lostQuantity: 0 }],
      });

    expect(createRes.status).toBe(201);
    const reportId = createRes.body.data.reportId as string;
    createdReportIds.push(reportId);

    const getRes = await request(app)
      .get(`/api/v1/inventory/return-reports/${reportId}`)
      .set('Authorization', authHeader(managerId, 'MANAGER'));
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.reportId).toBe(reportId);

    const confirmRes = await request(app)
      .put(`/api/v1/inventory/return-reports/${reportId}/confirm`)
      .set('Authorization', authHeader(managerId, 'MANAGER'))
      .send({});
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('CONFIRMED');
  });

  it('POST /api/v1/inventory/return-reports is forbidden for ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/return-reports')
      .set('Authorization', authHeader(adminId, 'ADMIN'))
      .send({ orderId: order1Id, reportType: 'INTERNAL', items: [{ itemId: fixtureItemId, goodQuantity: 1 }] });
    expect(res.status).toBe(403);
  });
});
