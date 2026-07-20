import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Item } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { customerRepository } from '../customer.repository';
import { computeOrderLines, computeOrderTotal, orderRepository } from '../order.repository';
import { orderService } from '../order.service';
import { quotationRepository } from '../quotation.repository';

jest.mock('../customer.repository', () => ({
  customerRepository: { findById: jest.fn() },
}));

jest.mock('../quotation.repository', () => {
  const actual = jest.requireActual('../quotation.repository');
  return { ...actual, quotationRepository: { ...actual.quotationRepository, findById: jest.fn() } };
});

jest.mock('../order.repository', () => {
  const actual = jest.requireActual('../order.repository');
  return {
    ...actual,
    orderRepository: {
      findItemsByIds: jest.fn(),
      generateNextOrderCode: jest.fn(),
      findMany: jest.fn(),
      countByStatusGlobal: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      replaceItems: jest.fn(),
    },
  };
});

const mockedCustomerRepo = customerRepository as jest.Mocked<typeof customerRepository>;
const mockedQuotationRepo = quotationRepository as jest.Mocked<typeof quotationRepository>;
const mockedOrderRepo = orderRepository as jest.Mocked<typeof orderRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeItem(overrides: Partial<Item> = {}): Item {
  return {
    itemId: 'item-1',
    itemCode: 'ITM-001',
    itemName: 'Loa JBL 1000W',
    typeId: 'type-1',
    description: null,
    unit: 'Cái',
    rentalPrice: 500000 as unknown as Item['rentalPrice'],
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

function fakeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    customerId: 'cus-1',
    customerCode: 'cus-1',
    customerName: 'Nguyễn Minh Trí',
    phone: '0910000000',
    email: 'tri.nm@gmail.com',
    address: '123 Nguyễn Huệ',
    notes: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// Builds a fake `OrderWithDetails` row using the REAL compute functions, so route-level
// assertions cross-check the same arithmetic the repository would actually perform.
function buildOrderRow(params: {
  orderId?: string;
  orderCode?: string;
  orderStatus?: 'NEW' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  items: { itemId: string; quantity: number; unitPrice: number }[];
}) {
  const lines = computeOrderLines(params.items);
  const totalAmount = computeOrderTotal(lines);
  return {
    orderId: params.orderId ?? 'ord-1',
    orderCode: params.orderCode ?? 'ORD-002',
    customerId: 'cus-1',
    customer: { customerName: 'Nguyễn Minh Trí', phone: '0910000000', email: 'tri.nm@gmail.com', address: '123 Nguyễn Huệ' },
    quotationId: null,
    eventType: 'Conference',
    eventName: 'Tech Summit 2026',
    eventDate: new Date('2026-08-15T09:00:00Z'),
    location: '123 Tech St. Hall A',
    guestCount: 100,
    totalAmount,
    paymentStatus: 'UNPAID',
    orderStatus: params.orderStatus ?? 'NEW',
    cancelReason: null,
    notes: null,
    creator: { userId: 'user-1', fullName: 'Project Manager', role: 'MANAGER' },
    createdAt: new Date('2026-07-20T00:00:00Z'),
    updatedAt: new Date('2026-07-20T00:00:00Z'),
    orderItems: lines.map((line, index) => ({
      orderItemId: `oi-${index + 1}`,
      itemId: line.itemId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: line.subtotal,
      source: line.source,
      preparedQty: 0,
      notes: line.notes,
      item: { itemName: 'Loa JBL 1000W', unit: 'Cái' },
    })),
  };
}

describe('computeOrderLines / computeOrderTotal (pure math)', () => {
  it('computes subtotal = quantity * unitPrice (OrderItem has no discount column) and sums totalAmount', () => {
    const lines = computeOrderLines([
      { itemId: 'item-1', quantity: 2, unitPrice: 500000 },
      { itemId: 'item-2', quantity: 3, unitPrice: 300000 },
    ]);

    expect(lines[0].subtotal).toBe(2 * 500000);
    expect(lines[1].subtotal).toBe(3 * 300000);
    expect(computeOrderTotal(lines)).toBe(2 * 500000 + 3 * 300000);
  });

  it('defaults source to INTERNAL when not provided', () => {
    const lines = computeOrderLines([{ itemId: 'item-1', quantity: 1, unitPrice: 100 }]);
    expect(lines[0].source).toBe('INTERNAL');
  });
});

describe('orderService.createOrder', () => {
  it('throws 404 when the customer does not exist', async () => {
    mockedCustomerRepo.findById.mockResolvedValue(null);

    await expect(
      orderService.createOrder(
        {
          customerId: 'missing',
          eventType: 'Conference',
          eventDate: new Date('2026-08-15T09:00:00Z'),
          location: 'Hall A',
          items: [{ itemId: 'item-1', quantity: 1, unitPrice: 100, source: 'INTERNAL' }],
        } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 404 when the given quotationId does not exist', async () => {
    mockedCustomerRepo.findById.mockResolvedValue(fakeCustomer() as never);
    mockedQuotationRepo.findById.mockResolvedValue(null);

    await expect(
      orderService.createOrder(
        {
          customerId: 'cus-1',
          quotationId: 'missing-quo',
          eventType: 'Conference',
          eventDate: new Date('2026-08-15T09:00:00Z'),
          location: 'Hall A',
          items: [{ itemId: 'item-1', quantity: 1, unitPrice: 100, source: 'INTERNAL' }],
        } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 when an itemId does not exist in the catalog', async () => {
    mockedCustomerRepo.findById.mockResolvedValue(fakeCustomer() as never);
    mockedOrderRepo.findItemsByIds.mockResolvedValue([]);

    await expect(
      orderService.createOrder(
        {
          customerId: 'cus-1',
          eventType: 'Conference',
          eventDate: new Date('2026-08-15T09:00:00Z'),
          location: 'Hall A',
          items: [{ itemId: 'ghost-item', quantity: 1, unitPrice: 100, source: 'INTERNAL' }],
        } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' });
  });

  it('returns only {orderId, orderCode} on success, with totalAmount computed server-side', async () => {
    mockedCustomerRepo.findById.mockResolvedValue(fakeCustomer() as never);
    mockedOrderRepo.findItemsByIds.mockResolvedValue([fakeItem()]);
    mockedOrderRepo.generateNextOrderCode.mockResolvedValue('ORD-002');
    mockedOrderRepo.create.mockResolvedValue(
      buildOrderRow({ items: [{ itemId: 'item-1', quantity: 2, unitPrice: 500000 }] }) as never,
    );

    const result = await orderService.createOrder(
      {
        customerId: 'cus-1',
        eventType: 'Conference',
        eventDate: new Date('2026-08-15T09:00:00Z'),
        location: 'Hall A',
        items: [{ itemId: 'item-1', quantity: 2, unitPrice: 500000, source: 'INTERNAL' }],
      } as never,
      'user-1',
    );

    expect(result).toEqual({ orderId: 'ord-1', orderCode: 'ORD-002' });
  });
});

describe('orderService.updateOrderStatus / updateOrderItems — terminal-state guard', () => {
  it('rejects a status update on a COMPLETED order with 400', async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      buildOrderRow({ orderStatus: 'COMPLETED', items: [{ itemId: 'item-1', quantity: 1, unitPrice: 100 }] }) as never,
    );

    await expect(
      orderService.updateOrderStatus('ord-1', { orderStatus: 'IN_PROGRESS' } as never),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockedOrderRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects an items update on a CANCELLED order with 400', async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      buildOrderRow({ orderStatus: 'CANCELLED', items: [{ itemId: 'item-1', quantity: 1, unitPrice: 100 }] }) as never,
    );

    await expect(
      orderService.updateOrderItems('ord-1', [{ itemId: 'item-1', quantity: 2, unitPrice: 100, source: 'INTERNAL' }]),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockedOrderRepo.replaceItems).not.toHaveBeenCalled();
  });

  it('allows a status update on a NEW order and persists cancelReason on cancel', async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      buildOrderRow({ orderStatus: 'NEW', items: [{ itemId: 'item-1', quantity: 1, unitPrice: 100 }] }) as never,
    );
    mockedOrderRepo.updateStatus.mockResolvedValue(
      buildOrderRow({ orderStatus: 'CANCELLED', items: [{ itemId: 'item-1', quantity: 1, unitPrice: 100 }] }) as never,
    );

    const result = await orderService.updateOrderStatus('ord-1', {
      orderStatus: 'CANCELLED',
      cancelReason: 'Khách hủy sự kiện',
    } as never);

    expect(mockedOrderRepo.updateStatus).toHaveBeenCalledWith('ord-1', 'CANCELLED', 'Khách hủy sự kiện');
    expect(result.orderStatus).toBe('CANCELLED');
  });
});

describe('orderService.listOrders', () => {
  it('reports meta.counts and pagination independent of the active filters', async () => {
    mockedOrderRepo.findMany.mockResolvedValue({
      rows: [
        {
          orderId: 'ord-1',
          orderCode: 'ORD-001',
          customerId: 'cus-1',
          eventType: 'Conference',
          eventName: 'Tech Summit 2026',
          eventDate: new Date('2026-08-15T09:00:00Z'),
          location: 'Hall A',
          guestCount: 500,
          totalAmount: 1_600_000,
          paymentStatus: 'UNPAID',
          orderStatus: 'CONFIRMED',
          createdAt: new Date('2026-07-19T09:47:37.000Z'),
          customer: { customerName: 'Nguyễn Minh Trí', phone: '0910000000' },
        },
      ],
      totalItems: 1,
    } as never);
    mockedOrderRepo.countByStatusGlobal.mockResolvedValue({
      all: 1,
      new: 0,
      confirmed: 1,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    });

    const result = await orderService.listOrders({ page: 1, limit: 10 } as never);

    expect(result.data[0]).toMatchObject({ orderId: 'ord-1', orderCode: 'ORD-001', orderStatus: 'CONFIRMED' });
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      totalItems: 1,
      totalPages: 1,
      counts: { all: 1, new: 0, confirmed: 1, inProgress: 0, completed: 0, cancelled: 0 },
    });
  });
});

describe('HTTP routes', () => {
  it('POST /api/v1/orders rejects an empty items array with 400', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', authHeader())
      .send({
        customerId: 'cus-1',
        eventType: 'Conference',
        eventDate: '2026-08-15T09:00:00Z',
        location: 'Hall A',
        items: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/orders is forbidden for non-Manager roles', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', authHeader('ADMIN'))
      .send({
        customerId: 'cus-1',
        eventType: 'Conference',
        eventDate: '2026-08-15T09:00:00Z',
        location: 'Hall A',
        items: [{ itemId: 'item-1', quantity: 1, unitPrice: 100 }],
      });

    expect(res.status).toBe(403);
  });

  it('PUT /api/v1/orders/:orderId/status rejects CANCELLED without cancelReason (400, before touching the DB)', async () => {
    const res = await request(app)
      .put('/api/v1/orders/ord-1/status')
      .set('Authorization', authHeader())
      .send({ orderStatus: 'CANCELLED' });

    expect(res.status).toBe(400);
    expect(mockedOrderRepo.findById).not.toHaveBeenCalled();
  });

  it('GET /api/v1/orders/:orderId returns the mapped detail with items', async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      buildOrderRow({ items: [{ itemId: 'item-1', quantity: 2, unitPrice: 500000 }] }) as never,
    );

    const res = await request(app).get('/api/v1/orders/ord-1').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ orderId: 'ord-1', totalAmount: 1_000_000 });
    expect(res.body.data.items[0]).toMatchObject({ itemName: 'Loa JBL 1000W', unit: 'Cái', subtotal: 1_000_000 });
  });
});
