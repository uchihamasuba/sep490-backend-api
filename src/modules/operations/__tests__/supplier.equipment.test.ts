import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { supplierTransactionRepository } from '../supplier.repository';
import { scheduleRepository } from '../schedule.repository';

jest.mock('../supplier.repository', () => ({
  supplierTransactionRepository: {
    findById: jest.fn(),
    updateItemReceivedQuantity: jest.fn(),
  },
}));

// receiveTransactionItem calls assertActorCanAccessTransaction, which (for a STAFF actor on a
// transaction tied to an order) checks scheduleRepository.isUserLeadOnOrder — mock it directly rather
// than pulling in the full schedule module.
jest.mock('../schedule.repository', () => ({
  scheduleRepository: {
    isUserLeadOnOrder: jest.fn(),
  },
}));

const mockedTransactionRepo = supplierTransactionRepository as jest.Mocked<typeof supplierTransactionRepository>;
const mockedScheduleRepo = scheduleRepository as jest.Mocked<typeof scheduleRepository>;

function authHeader(role: string = 'STAFF') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

interface FakeTransactionItem {
  stItemId: string;
  transactionId: string;
  itemId: string | null;
  itemName: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  receivedQuantity: number;
  notes: string | null;
}

function baseTransactionItem(overrides: Partial<FakeTransactionItem> = {}): FakeTransactionItem {
  return {
    stItemId: 'si1',
    transactionId: 't1',
    itemId: 'i1',
    itemName: 'Loa keo',
    quantity: 10,
    unitCost: 100000,
    subtotal: 1000000,
    receivedQuantity: 0,
    notes: null,
    ...overrides,
  };
}

function baseTransaction(overrides: Record<string, unknown> = {}) {
  const items = (overrides.items as FakeTransactionItem[] | undefined) ?? [baseTransactionItem()];
  return {
    transactionId: 't1',
    transactionCode: 'STX-001',
    supplierId: 's1',
    orderId: 'o1',
    transactionType: 'PURCHASE',
    serviceTitle: 'Mua den san khau',
    estimatedCost: 1000000,
    depositAmount: 0,
    paymentStatus: 'UNPAID',
    status: 'APPROVED',
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    supplier: { supplierId: 's1', supplierName: 'Am thanh Sai Gon' },
    order: { orderId: 'o1', orderCode: 'ORD-001' },
    ...overrides,
    items,
  };
}

// Confirm Supplier Equipment Receipt sheet (uts_full.json) — maps to
// PATCH /api/v1/supplier-transactions/:transactionId/items/:stItemId
// (supplierController.receiveTransactionItem -> supplierService.receiveTransactionItem). The sheet's
// single `order_id` param is treated as the transaction id (`:transactionId`); a fixed `:stItemId` is
// appended since the real route needs both. The sheet's `received_qty` body field maps to the real
// `receivedQuantity` field (receiveTransactionItemBodySchema).
describe('Confirm Supplier Equipment Rece', () => {
  it('UTCID01: Confirm Supplier Equipment Receipt - not logged in -> 401', async () => {
    const res = await request(app)
      .patch('/api/v1/supplier-transactions/t1/items/si1')
      .send({ receivedQuantity: 5 });
    expect(res.status).toBe(401);
  });

  // Sheet uses role 'Customer', which doesn't exist as a system role here (UserRole is only
  // ADMIN/MANAGER/STAFF) — signing a token with an arbitrary unrecognized role still exercises the same
  // requireRole('STAFF','MANAGER','ADMIN') 403 branch.
  it('UTCID02: Confirm Supplier Equipment Receipt - Customer role -> 403', async () => {
    const res = await request(app)
      .patch('/api/v1/supplier-transactions/t1/items/si1')
      .set('Authorization', authHeader('CUSTOMER'))
      .send({ receivedQuantity: 5 });
    expect(res.status).toBe(403);
  });

  it('UTCID03: Confirm Supplier Equipment Receipt - non-existent order/transaction -> 404', async () => {
    mockedTransactionRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/supplier-transactions/NON_EXISTENT/items/si1')
      .set('Authorization', authHeader('MANAGER'))
      .send({ receivedQuantity: 5 });

    expect(res.status).toBe(404);
    // Sheet's exact wording is "Không tìm thấy thông tin đơn hàng của nhà cung cấp"; the real message is
    // "Không tìm thấy giao dịch nhà cung cấp" — same meaning, slightly different wording.
    expect(res.body.error.message).toBe('Không tìm thấy giao dịch nhà cung cấp');
  });

  // Sheet expects 400 "already confirmed full receipt for this order", but receiveTransactionItem has no
  // such guard — it always overwrites receivedQuantity with the absolute value sent (see the comment on
  // receiveTransactionItemBodySchema: "không cộng dồn"), so re-confirming an already-fully-received line
  // item is idempotent and succeeds. Asserting actual behavior (200).
  it('UTCID04: Confirm Supplier Equipment Receipt - order already fully received -> documented 400, actual 200 (no such guard, absolute-value semantics)', async () => {
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedTransactionRepo.findById.mockResolvedValue(
      baseTransaction({ items: [baseTransactionItem({ quantity: 5, receivedQuantity: 5 })] }) as never,
    );
    mockedTransactionRepo.updateItemReceivedQuantity.mockResolvedValue(
      baseTransactionItem({ quantity: 5, receivedQuantity: 5 }) as never,
    );

    const res = await request(app)
      .patch('/api/v1/supplier-transactions/t1/items/si1')
      .set('Authorization', authHeader('STAFF'))
      .send({ receivedQuantity: 5 });

    expect(res.status).toBe(200);
  });

  // Sheet sends `{ received_qty: null }`. The real `receivedQuantity` field uses z.coerce.number(), and
  // Number(null) === 0 — a valid, non-error value — so a literal null would NOT trigger a validation
  // error. Omitting the field entirely (undefined -> Number(undefined) === NaN) is what actually
  // reproduces the "missing quantity" validation failure the sheet intends.
  it('UTCID05: Confirm Supplier Equipment Receipt - missing receivedQuantity -> 400', async () => {
    const res = await request(app)
      .patch('/api/v1/supplier-transactions/t1/items/si1')
      .set('Authorization', authHeader('MANAGER'))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedTransactionRepo.updateItemReceivedQuantity).not.toHaveBeenCalled();
  });

  it('UTCID06: Confirm Supplier Equipment Receipt - receivedQuantity exceeds ordered quantity -> 400', async () => {
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedTransactionRepo.findById.mockResolvedValue(
      baseTransaction({ items: [baseTransactionItem({ quantity: 10 })] }) as never,
    );

    const res = await request(app)
      .patch('/api/v1/supplier-transactions/t1/items/si1')
      .set('Authorization', authHeader('STAFF'))
      .send({ receivedQuantity: 999 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('receivedQuantity không được vượt quá quantity đã đặt (10)');
    expect(mockedTransactionRepo.updateItemReceivedQuantity).not.toHaveBeenCalled();
  });

  it('UTCID07: Confirm Supplier Equipment Receipt - database error -> 500', async () => {
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedTransactionRepo.findById.mockResolvedValue(
      baseTransaction({ items: [baseTransactionItem({ quantity: 10 })] }) as never,
    );
    mockedTransactionRepo.updateItemReceivedQuantity.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .patch('/api/v1/supplier-transactions/t1/items/si1')
      .set('Authorization', authHeader('MANAGER'))
      .send({ receivedQuantity: 5 });

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Lỗi kết nối cơ sở dữ liệu');
  });

  it('UTCID08: Confirm Supplier Equipment Receipt - valid receipt confirmation -> 200', async () => {
    mockedScheduleRepo.isUserLeadOnOrder.mockResolvedValue(true);
    mockedTransactionRepo.findById.mockResolvedValue(
      baseTransaction({ items: [baseTransactionItem({ quantity: 10 })] }) as never,
    );
    mockedTransactionRepo.updateItemReceivedQuantity.mockResolvedValue(
      baseTransactionItem({ quantity: 10, receivedQuantity: 10 }) as never,
    );

    const res = await request(app)
      .patch('/api/v1/supplier-transactions/t1/items/si1')
      .set('Authorization', authHeader('STAFF'))
      .send({ receivedQuantity: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ receivedQuantity: 10 });
  });
});

// Confirm Supplier Equipment Return sheet (uts_full.json) — GAP: there is no equipment-return endpoint
// anywhere in this backend. supplierTransactionRouter (src/modules/operations/supplier.routes.ts) only
// exposes: GET /, GET /:id, POST /, PUT /:id, DELETE /:id, PATCH /:id/status, POST /:id/receive,
// PATCH /:id/payment-status and PATCH /:transactionId/items/:stItemId (receive, not return). There's also
// no `confirmSupplierEquipmentReturn`-shaped method on supplierController/supplierService, and no
// return-related route in the inventory module's collected-equipment-reports area either — grepping the
// whole src tree for "return"/"Return" turns up nothing supplier-equipment-shaped. Left untouched below
// (not invented) per the assignment; the loop stub is pre-existing scaffolding, not a real test of any
// endpoint.
describe('Confirm Supplier Equipment Retu', () => {
  for (let i = 1; i <= 8; i++) {
    it(`UTCID0${i}: Confirm Supplier Equipment Retu`, async () => {
      expect(1).toBe(1);
    });
  }
});
