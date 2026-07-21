import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { InsufficientStockError, orderRepository } from '../order.repository';
import { quotationRepository } from '../quotation.repository';

jest.mock('../order.repository', () => {
  const actual = jest.requireActual('../order.repository');
  return {
    ...actual,
    orderRepository: {
      ...actual.orderRepository,
      findById: jest.fn(),
      exportEquipment: jest.fn(),
    },
  };
});

jest.mock('../quotation.repository', () => {
  const actual = jest.requireActual('../quotation.repository');
  return {
    ...actual,
    quotationRepository: {
      ...actual.quotationRepository,
      findById: jest.fn(),
    },
  };
});

const mockedOrderRepo = orderRepository as jest.Mocked<typeof orderRepository>;
const mockedQuotationRepo = quotationRepository as jest.Mocked<typeof quotationRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeOrderDetail(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'order-1',
    orderCode: 'ORD-013',
    orderStatus: 'NEW',
    quotationId: 'quo-16',
    pickedUpAt: null,
    pickedUpBy: null,
    customer: { customerName: 'dat', phone: '0828937456', email: null, address: 'hahahaha' },
    creator: { userId: 'user-1', fullName: 'Project Manager', role: 'MANAGER' },
    orderItems: [
      {
        orderItemId: 'oi-1',
        itemId: 'item-beam',
        quantity: 1,
        source: 'INTERNAL',
        preparedQty: 0,
        item: { itemName: 'Đèn Beam 230', unit: 'Cái' },
      },
    ],
    ...overrides,
  };
}

function fakeQuotation(overrides: Record<string, unknown> = {}) {
  return {
    quotationId: 'quo-16',
    quotationCode: 'QUO-016',
    status: 'APPROVED',
    items: [
      { itemId: 'item-beam', itemName: 'Đèn Beam 230', quantity: 1, price: 300000, lineTotal: 300000 },
      { itemId: 'item-jbl', itemName: 'Loa JBL 1000W', quantity: 8, price: 500000, lineTotal: 4000000 },
    ],
    ...overrides,
  };
}

describe('POST /api/v1/orders/:orderId/export-equipment (v2 reconcile)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('syncs items from the linked quotation and reports the movements actually written this run', async () => {
    const pickedUpAt = new Date('2026-07-21T12:00:00.000Z');
    mockedOrderRepo.findById.mockResolvedValue(fakeOrderDetail() as never);
    mockedQuotationRepo.findById.mockResolvedValue(fakeQuotation() as never);
    mockedOrderRepo.exportEquipment.mockResolvedValue({
      order: fakeOrderDetail({
        pickedUpAt,
        pickedUpBy: 'user-1',
        orderItems: [
          {
            orderItemId: 'oi-1',
            itemId: 'item-beam',
            quantity: 1,
            source: 'INTERNAL',
            preparedQty: 0,
            item: { itemName: 'Đèn Beam 230', unit: 'Cái' },
          },
          {
            orderItemId: 'oi-2',
            itemId: 'item-jbl',
            quantity: 8,
            source: 'INTERNAL',
            preparedQty: 0,
            item: { itemName: 'Loa JBL 1000W', unit: 'Cái' },
          },
        ],
      }),
      movements: [{ itemId: 'item-jbl', itemName: 'Loa JBL 1000W', quantity: 8, movementType: 'OUTBOUND' }],
      itemsChanged: true,
    } as never);

    const res = await request(app)
      .post('/api/v1/orders/order-1/export-equipment')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      orderId: 'order-1',
      orderCode: 'ORD-013',
      syncedQuotationId: 'quo-16',
      syncedQuotationCode: 'QUO-016',
      pickedUpAt: pickedUpAt.toISOString(),
      pickedUpBy: 'user-1',
      movements: [{ itemId: 'item-jbl', itemName: 'Loa JBL 1000W', quantity: 8, movementType: 'OUTBOUND' }],
      skippedSupplierItems: [],
      unchanged: false,
    });
    // Target lines được dựng từ quotation_items (snapshot itemName, price/lineTotal → unitPrice/subtotal).
    expect(mockedOrderRepo.exportEquipment).toHaveBeenCalledWith({
      orderId: 'order-1',
      performedBy: 'user-1',
      notes: null,
      quotationCode: 'QUO-016',
      targetLines: [
        { itemId: 'item-beam', itemName: 'Đèn Beam 230', quantity: 1, unitPrice: 300000, subtotal: 300000 },
        { itemId: 'item-jbl', itemName: 'Loa JBL 1000W', quantity: 8, unitPrice: 500000, subtotal: 4000000 },
      ],
    });
  });

  it('re-run with no changes is a valid no-op: 200 + unchanged: true, pickedUpAt untouched', async () => {
    const previousPickedUpAt = new Date('2026-07-20T09:00:00.000Z');
    mockedOrderRepo.findById.mockResolvedValue(
      fakeOrderDetail({ pickedUpAt: previousPickedUpAt, pickedUpBy: 'user-0' }) as never,
    );
    mockedQuotationRepo.findById.mockResolvedValue(fakeQuotation() as never);
    mockedOrderRepo.exportEquipment.mockResolvedValue({
      order: fakeOrderDetail({ pickedUpAt: previousPickedUpAt, pickedUpBy: 'user-0' }),
      movements: [],
      itemsChanged: false,
    } as never);

    const res = await request(app)
      .post('/api/v1/orders/order-1/export-equipment')
      .set('Authorization', authHeader())
      .send({});

    // v1 chặn 409 khi pickedUpAt đã set — v2 phải cho chạy lại bình thường.
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      unchanged: true,
      movements: [],
      pickedUpAt: previousPickedUpAt.toISOString(),
      pickedUpBy: 'user-0',
    });
  });

  it('reports INBOUND recall movements when the quotation dropped exported items', async () => {
    mockedOrderRepo.findById.mockResolvedValue(fakeOrderDetail({ pickedUpAt: new Date() }) as never);
    mockedQuotationRepo.findById.mockResolvedValue(
      fakeQuotation({ items: [{ itemId: 'item-beam', itemName: 'Đèn Beam 230', quantity: 1, price: 300000, lineTotal: 300000 }] }) as never,
    );
    mockedOrderRepo.exportEquipment.mockResolvedValue({
      order: fakeOrderDetail({ pickedUpAt: new Date(), pickedUpBy: 'user-1' }),
      movements: [{ itemId: 'item-jbl', itemName: 'Loa JBL 1000W', quantity: 8, movementType: 'INBOUND' }],
      itemsChanged: true,
    } as never);

    const res = await request(app)
      .post('/api/v1/orders/order-1/export-equipment')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.movements).toEqual([
      { itemId: 'item-jbl', itemName: 'Loa JBL 1000W', quantity: 8, movementType: 'INBOUND' },
    ]);
    expect(res.body.data.unchanged).toBe(false);
  });

  it('keeps SUPPLIER lines out of the warehouse flow and lists them in skippedSupplierItems', async () => {
    mockedOrderRepo.findById.mockResolvedValue(fakeOrderDetail() as never);
    mockedQuotationRepo.findById.mockResolvedValue(fakeQuotation() as never);
    mockedOrderRepo.exportEquipment.mockResolvedValue({
      order: fakeOrderDetail({
        orderItems: [
          {
            orderItemId: 'oi-2',
            itemId: 'item-jbl',
            quantity: 8,
            source: 'SUPPLIER',
            preparedQty: 0,
            item: { itemName: 'Loa JBL 1000W', unit: 'Cái' },
          },
        ],
      }),
      movements: [],
      itemsChanged: false,
    } as never);

    const res = await request(app)
      .post('/api/v1/orders/order-1/export-equipment')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.skippedSupplierItems).toEqual([
      { itemId: 'item-jbl', itemName: 'Loa JBL 1000W', quantity: 8 },
    ]);
  });

  it('forwards optional notes to the repository', async () => {
    mockedOrderRepo.findById.mockResolvedValue(fakeOrderDetail() as never);
    mockedQuotationRepo.findById.mockResolvedValue(fakeQuotation() as never);
    mockedOrderRepo.exportEquipment.mockResolvedValue({
      order: fakeOrderDetail(),
      movements: [],
      itemsChanged: false,
    } as never);

    await request(app)
      .post('/api/v1/orders/order-1/export-equipment')
      .set('Authorization', authHeader())
      .send({ notes: 'Xuất từ báo giá QUO-016' });

    expect(mockedOrderRepo.exportEquipment).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Xuất từ báo giá QUO-016' }),
    );
  });

  it('returns 404 when the order does not exist', async () => {
    mockedOrderRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/orders/missing/export-equipment')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(404);
    expect(mockedOrderRepo.exportEquipment).not.toHaveBeenCalled();
  });

  it('returns 409 when the order has no linked quotation', async () => {
    mockedOrderRepo.findById.mockResolvedValue(fakeOrderDetail({ quotationId: null }) as never);

    const res = await request(app)
      .post('/api/v1/orders/order-1/export-equipment')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(409);
    expect(mockedOrderRepo.exportEquipment).not.toHaveBeenCalled();
  });

  it('returns 409 for terminal orders (CANCELLED/COMPLETED)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(fakeOrderDetail({ orderStatus: 'CANCELLED' }) as never);

    const res = await request(app)
      .post('/api/v1/orders/order-1/export-equipment')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(409);
  });

  it('returns 400 with delta-based details when stock cannot cover the top-up (transaction rolled back)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(fakeOrderDetail() as never);
    mockedQuotationRepo.findById.mockResolvedValue(fakeQuotation() as never);
    // required = phần cần xuất THÊM (delta), không phải tổng SL của dòng (mục 4.2).
    mockedOrderRepo.exportEquipment.mockRejectedValue(
      new InsufficientStockError([{ itemId: 'item-jbl', itemName: 'Loa JBL 1000W', required: 3, available: 1 }]),
    );

    const res = await request(app)
      .post('/api/v1/orders/order-1/export-equipment')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('item-jbl');
    expect(JSON.stringify(res.body)).toContain('"required":3');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post('/api/v1/orders/order-1/export-equipment').send({});
    expect(res.status).toBe(401);
  });

  it('is forbidden for non-Manager roles (Admin read-only trong cụm Kho vận)', async () => {
    const res = await request(app)
      .post('/api/v1/orders/order-1/export-equipment')
      .set('Authorization', authHeader('ADMIN'))
      .send({});

    expect(res.status).toBe(403);
  });
});
