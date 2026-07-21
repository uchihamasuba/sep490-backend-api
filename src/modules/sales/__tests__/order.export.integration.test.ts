import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';

// Integration test THẬT cho POST /orders/:orderId/export-equipment — không mock repository, chạy trên
// DB thật với fixture riêng (tạo ở beforeAll, dọn ở afterAll, idempotent khi chạy lại). Sinh ra từ BUG
// mục 7 docs/api/xuatthietbi_tubaogia_api.md: transaction timeout 5000ms mặc định vỡ với đơn ≥ 3 hạng
// mục do DB Aiven latency — test này ép đơn 5 hạng mục đi qua transaction thật để chặn tái diễn.
jest.setTimeout(90000);

const prisma = new PrismaClient();

const ITEM_COUNT = 5;
const QTY_PER_ITEM = 2;
const STOCK_PER_ITEM = 10;

function authHeader(userId: string, role: 'MANAGER' | 'ADMIN' = 'MANAGER') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

let managerId: string;
let customerId: string;
let quotationId: string;
let orderId: string;
const itemIds: string[] = [];

beforeAll(async () => {
  const manager = await prisma.user.findUniqueOrThrow({ where: { username: 'manager' } });
  managerId = manager.userId;
  const anyItem = await prisma.item.findFirstOrThrow({ select: { typeId: true } });

  customerId = randomUUID();
  await prisma.customer.create({
    data: {
      customerId,
      customerCode: `CUS-TEST-EXP-${Date.now()}`,
      customerName: 'Export Fixture Customer',
      phone: '0000000000',
    },
  });

  for (let i = 0; i < ITEM_COUNT; i += 1) {
    const itemId = randomUUID();
    itemIds.push(itemId);
    await prisma.item.create({
      data: {
        itemId,
        itemCode: `ITM-TEST-EXP-${Date.now()}-${i}`,
        itemName: `Export Fixture Item ${i + 1}`,
        typeId: anyItem.typeId,
        unit: 'Cái',
        rentalPrice: 100000,
      },
    });
    await prisma.inventory.create({
      data: {
        inventoryId: randomUUID(),
        itemId,
        quantityTotal: STOCK_PER_ITEM,
        quantityDamaged: 0,
        quantityReserved: 0,
        quantityAvailable: STOCK_PER_ITEM,
      },
    });
  }

  quotationId = randomUUID();
  await prisma.quotation.create({
    data: {
      quotationId,
      quotationCode: `QUO-TEST-EXP-${Date.now()}`,
      customerId,
      version: 'v1',
      status: 'APPROVED',
      createdBy: managerId,
      items: {
        create: itemIds.map((itemId, i) => ({
          quotationItemId: randomUUID(),
          itemId,
          itemName: `Export Fixture Item ${i + 1}`,
          quantity: QTY_PER_ITEM,
          price: 100000,
          discount: 0,
          lineTotal: QTY_PER_ITEM * 100000,
        })),
      },
    },
  });

  orderId = randomUUID();
  // Đơn liên kết báo giá nhưng CHƯA có order_items — đúng case thật gây bug (ORD-002/QUO-003).
  await prisma.order.create({
    data: {
      orderId,
      orderCode: `ORD-TEST-EXP-${Date.now()}`,
      customerId,
      quotationId,
      eventType: 'Test',
      eventDate: new Date('2026-12-01T02:00:00.000Z'),
      location: 'Export fixture location',
      createdBy: managerId,
      orderStatus: 'NEW',
    },
  });
});

afterAll(async () => {
  await prisma.inventoryMovement.deleteMany({ where: { orderId } });
  await prisma.order.deleteMany({ where: { orderId } }); // order_items cascade theo order_id
  await prisma.quotation.deleteMany({ where: { quotationId } }); // quotation_items cascade
  await prisma.inventory.deleteMany({ where: { itemId: { in: itemIds } } });
  await prisma.item.deleteMany({ where: { itemId: { in: itemIds } } });
  await prisma.customer.deleteMany({ where: { customerId } });
  await prisma.$disconnect();
});

describe('POST /api/v1/orders/:orderId/export-equipment — integration, đơn 5 hạng mục (BUG mục 7)', () => {
  it('lần 1: sync 5 order_items từ báo giá + xuất kho 5 movement OUTBOUND trong 1 transaction, không timeout', async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/export-equipment`)
      .set('Authorization', authHeader(managerId))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.unchanged).toBe(false);
    expect(res.body.data.movements).toHaveLength(ITEM_COUNT);
    expect(res.body.data.movements.every((m: { movementType: string }) => m.movementType === 'OUTBOUND')).toBe(true);
    expect(res.body.data.pickedUpAt).not.toBeNull();

    const orderItems = await prisma.orderItem.findMany({ where: { orderId } });
    expect(orderItems).toHaveLength(ITEM_COUNT);
    expect(orderItems.every((line) => line.quantity === QTY_PER_ITEM && line.source === 'INTERNAL')).toBe(true);

    const inventories = await prisma.inventory.findMany({ where: { itemId: { in: itemIds } } });
    expect(inventories.every((inv) => inv.quantityAvailable === STOCK_PER_ITEM - QTY_PER_ITEM)).toBe(true);
    expect(inventories.every((inv) => inv.quantityReserved === QTY_PER_ITEM)).toBe(true);
  });

  it('lần 2 không đổi gì: no-op 200 unchanged: true, không sinh movement mới', async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/export-equipment`)
      .set('Authorization', authHeader(managerId))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.unchanged).toBe(true);
    expect(res.body.data.movements).toHaveLength(0);

    const movementCount = await prisma.inventoryMovement.count({ where: { orderId } });
    expect(movementCount).toBe(ITEM_COUNT);
  });

  it('sửa báo giá tăng SL 1 hạng mục rồi chạy lại: chỉ xuất bù đúng delta', async () => {
    const bumpedItemId = itemIds[0];
    await prisma.quotationItem.updateMany({
      where: { quotationId, itemId: bumpedItemId },
      data: { quantity: QTY_PER_ITEM + 3, lineTotal: (QTY_PER_ITEM + 3) * 100000 },
    });

    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/export-equipment`)
      .set('Authorization', authHeader(managerId))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.unchanged).toBe(false);
    expect(res.body.data.movements).toEqual([
      expect.objectContaining({ itemId: bumpedItemId, quantity: 3, movementType: 'OUTBOUND' }),
    ]);

    const inv = await prisma.inventory.findUniqueOrThrow({ where: { itemId: bumpedItemId } });
    expect(inv.quantityAvailable).toBe(STOCK_PER_ITEM - QTY_PER_ITEM - 3);
    expect(inv.quantityReserved).toBe(QTY_PER_ITEM + 3);

    const line = await prisma.orderItem.findFirstOrThrow({ where: { orderId, itemId: bumpedItemId } });
    expect(line.quantity).toBe(QTY_PER_ITEM + 3);
  });
});
