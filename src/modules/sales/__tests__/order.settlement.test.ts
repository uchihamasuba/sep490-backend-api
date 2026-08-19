import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { orderRepository } from '../order.repository';

// Only the methods createSettlement touches are mocked; scheduleRepository.isUserLeadOnOrder and
// changeRequestService.sumApprovedAmount are left as the real implementation (same pattern as
// order.lifecycle.test.ts) — they hit the configured test DB with orderIds that don't exist there,
// which resolves to empty results (isUserLeadOnOrder -> false, sumApprovedAmount -> 0) rather than throwing.
jest.mock('../order.repository', () => {
  const actual = jest.requireActual('../order.repository');
  return {
    ...actual,
    orderRepository: {
      ...actual.orderRepository,
      findById: jest.fn(),
      sumDepositsByStatus: jest.fn(),
      findLatestSettlement: jest.fn(),
      createSettlement: jest.fn(),
      updateSettlementDraft: jest.fn(),
    },
  };
});

const mockedOrderRepo = orderRepository as jest.Mocked<typeof orderRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF' | 'CUSTOMER' = 'MANAGER', id = 'user-1') {
  const token = jwt.sign({ id, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function buildOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'O1',
    orderCode: 'ORD-001',
    orderStatus: 'IN_PROGRESS',
    paymentStatus: 'UNPAID',
    totalAmount: 5_000_000,
    ...overrides,
  };
}

function buildSettlementRow(overrides: Record<string, unknown> = {}) {
  return {
    settlementId: 'set-1',
    orderId: 'O1',
    additionalFee: 0,
    compensation: 0,
    discount: 0,
    finalAmount: 5_000_000,
    paymentMethod: null,
    qrCodeUrl: null,
    paidAt: null,
    status: 'UNPAID',
    requestedBy: 'user-1',
    requestedAt: new Date('2026-07-01T00:00:00Z'),
    confirmedBy: null,
    confirmedAt: null,
    notes: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

// "Confirm Settlement" (PUT /api/v1/settlements/:settlementId/confirm -> paymentController.
// confirmSettlement) is covered in payment.test.ts, next to the other tests for that router.

// ---------------------------------------------------------------------------------------------------
// Real coverage for "Create Settlement Request" (POST /orders/:orderId/settlement ->
// orderController.createSettlement -> orderService.createSettlement). Added as a second describe block
// with the same sheet name so the pre-existing placeholder loop above is left completely untouched.
//
// Field-shape note: the sheet describes the request body with an `amount`/`receipts` contract (e.g.
// `{ order_id, amount, receipts }`), but the real createSettlementBodySchema (order.validators.ts) has no
// such fields — `orderId` is a URL param (not body), the settlement amount (`finalAmount`) is always
// computed server-side from additionalFee/compensation/discount + order totals (never client-supplied),
// and there is no `receipts`/evidence requirement on this endpoint at all (evidence is only required
// later, on PUT /settlements/:id/mark-paid). Tests below adapt each UTCID's intent to the real body shape
// and note where actual behavior diverges from the sheet.
// ---------------------------------------------------------------------------------------------------
describe('Create Settlement Request', () => {
  // UTCID01: no user (no Authorization header) -> Expected: 401 (Backend returns: 401)
  it('UTCID01: rejects a request with no authenticated user', async () => {
    const res = await request(app).post('/api/v1/orders/O1/settlement').send({});

    expect(res.status).toBe(401);
    expect(mockedOrderRepo.findById).not.toHaveBeenCalled();
  });

  // UTCID02: role Customer -> Expected: 403 (Backend returns: 403, requireRole('MANAGER','STAFF') at
  // the route rejects any other role before the controller/service run)
  it('UTCID02: rejects a Customer role with 403', async () => {
    const res = await request(app)
      .post('/api/v1/orders/O1/settlement')
      .set('Authorization', authHeader('CUSTOMER'))
      .send({});

    expect(res.status).toBe(403);
    expect(mockedOrderRepo.findById).not.toHaveBeenCalled();
  });

  // UTCID03: order_id NON_EXISTENT -> Expected: 404 (Backend returns: 404)
  it('UTCID03: returns 404 when the order does not exist', async () => {
    mockedOrderRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/orders/NON_EXISTENT/settlement')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({});

    expect(res.status).toBe(404);
  });

  // UTCID04: Staff actor 'S1' creating a settlement for an order that isn't their (LEAD) order ->
  // Expected: 403 ("Bạn không có quyền tạo yêu cầu quyết toán cho Đơn hàng của người khác"). Actual:
  // orderService.createSettlement enforces this via scheduleRepository.isUserLeadOnOrder(actor.id,
  // orderId) for STAFF actors — not mocked here (real DB call), and 'O_OTHER' has no matching schedule
  // assignee for 'S1' in the test DB, so it resolves to false -> forbidden. Status matches; message text
  // differs slightly ("Chỉ Leader giữ vai trò LEAD..." vs the sheet's wording) but same underlying rule.
  it('UTCID04: rejects a Staff actor who is not the plan LEAD for this order (403)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ orderId: 'O_OTHER' }) as never);

    const res = await request(app)
      .post('/api/v1/orders/O_OTHER/settlement')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({});

    expect(res.status).toBe(403);
    expect(mockedOrderRepo.createSettlement).not.toHaveBeenCalled();
  });

  // UTCID05: order_id O_IN_PROGRESS (order not yet COMPLETED) -> spec expects 400 ("Đơn hàng chưa hoàn
  // tất, không thể tạo yêu cầu quyết toán"). Documented-vs-actual: orderService.createSettlement has NO
  // orderStatus guard at all (unlike createDeposit, it never calls assertNotTerminal) — it computes
  // finalAmount and creates/updates the settlement regardless of orderStatus. Asserting actual behavior:
  // an IN_PROGRESS order still succeeds (201).
  it('UTCID05: order not yet COMPLETED — actual backend has no status guard, request still succeeds (201)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ orderId: 'O_IN_PROGRESS', orderStatus: 'IN_PROGRESS' }) as never);
    mockedOrderRepo.sumDepositsByStatus.mockResolvedValue({ _sum: { amount: 0 } } as never);
    mockedOrderRepo.findLatestSettlement.mockResolvedValue(null);
    mockedOrderRepo.createSettlement.mockResolvedValue(buildSettlementRow({ orderId: 'O_IN_PROGRESS' }) as never);

    const res = await request(app)
      .post('/api/v1/orders/O_IN_PROGRESS/settlement')
      .set('Authorization', authHeader('MANAGER'))
      .send({});

    // Spec expects 400; actual backend has no orderStatus guard on this endpoint.
    expect(res.status).toBe(201);
  });

  // UTCID06: order_id O_ALREADY_SETTLED (an existing pending/approved settlement request already exists)
  // -> spec expects 400 ("Đã tồn tại yêu cầu quyết toán ... cho Đơn hàng này"). Documented-vs-actual:
  // orderService.createSettlement never blocks on an existing settlement — if the latest one is UNPAID it
  // updates that draft in place, and otherwise (e.g. already PAID) it just creates another settlement row.
  // There is no PENDING/APPROVED concept and no duplicate-request guard. Asserting actual behavior: a
  // PAID prior settlement still results in a new settlement being created (201).
  it('UTCID06: an existing (PAID) settlement does not block a new request — actual backend creates another row (201)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ orderId: 'O_ALREADY_SETTLED' }) as never);
    mockedOrderRepo.sumDepositsByStatus.mockResolvedValue({ _sum: { amount: 0 } } as never);
    mockedOrderRepo.findLatestSettlement.mockResolvedValue(buildSettlementRow({ status: 'PAID' }) as never);
    mockedOrderRepo.createSettlement.mockResolvedValue(buildSettlementRow({ orderId: 'O_ALREADY_SETTLED' }) as never);

    const res = await request(app)
      .post('/api/v1/orders/O_ALREADY_SETTLED/settlement')
      .set('Authorization', authHeader('MANAGER'))
      .send({});

    // Spec expects 400 (duplicate-request guard); actual backend has none for a PAID prior settlement.
    expect(res.status).toBe(201);
    expect(mockedOrderRepo.updateSettlementDraft).not.toHaveBeenCalled();
    expect(mockedOrderRepo.createSettlement).toHaveBeenCalled();
  });

  // UTCID07: negative settlement amount -> Expected: 400 ("Số tiền quyết toán phải lớn hơn 0"). Field-
  // shape note: real schema has no `amount` field — the closest real analog is a negative additionalFee
  // (createSettlementBodySchema: `additionalFee: z.coerce.number().nonnegative()`), which the same Zod
  // validation layer rejects with 400.
  it('UTCID07: rejects a negative additionalFee with 400 (real analog of a negative settlement amount)', async () => {
    const res = await request(app)
      .post('/api/v1/orders/O1/settlement')
      .set('Authorization', authHeader('MANAGER'))
      .send({ additionalFee: -500 });

    expect(res.status).toBe(400);
    expect(mockedOrderRepo.findById).not.toHaveBeenCalled();
  });

  // UTCID08: empty receipts array -> spec expects 400 ("Bắt buộc phải đính kèm hình ảnh hóa đơn").
  // Documented-vs-actual: createSettlementBodySchema has no receipts/evidence field or requirement at
  // all — evidence is only enforced later on PUT /settlements/:id/mark-paid (markSettlementPaidBodySchema
  // requires evidenceIds.length > 0), not on creation. Asserting actual behavior: the request still
  // succeeds (201) with no receipts supplied.
  it('UTCID08: no receipts required at creation time — actual backend still succeeds (201)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.sumDepositsByStatus.mockResolvedValue({ _sum: { amount: 0 } } as never);
    mockedOrderRepo.findLatestSettlement.mockResolvedValue(null);
    mockedOrderRepo.createSettlement.mockResolvedValue(buildSettlementRow() as never);

    const res = await request(app)
      .post('/api/v1/orders/O1/settlement')
      .set('Authorization', authHeader('MANAGER'))
      .send({ additionalFee: 1000 });

    // Spec expects 400 (missing receipts); actual backend has no such requirement on this endpoint.
    expect(res.status).toBe(201);
  });

  // UTCID09: DB connection error while looking up the order -> Expected: 500 (Backend returns: 500)
  it('UTCID09: database error while loading the order surfaces as 500', async () => {
    mockedOrderRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .post('/api/v1/orders/O1/settlement')
      .set('Authorization', authHeader('MANAGER'))
      .send({});

    expect(res.status).toBe(500);
  });

  // UTCID010: valid Manager request, amount 1000 -> spec expects 200. Documented-vs-actual: POST routes
  // use utils/response.ts `created()`, which replies 201 (not 200) — asserting actual REST status for a
  // newly-created resource.
  it('UTCID010: creates the settlement end-to-end (actual status 201, spec says 200)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.sumDepositsByStatus.mockResolvedValue({ _sum: { amount: 0 } } as never);
    mockedOrderRepo.findLatestSettlement.mockResolvedValue(null);
    mockedOrderRepo.createSettlement.mockResolvedValue(buildSettlementRow({ finalAmount: 1000 }) as never);

    const res = await request(app)
      .post('/api/v1/orders/O1/settlement')
      .set('Authorization', authHeader('MANAGER'))
      .send({ additionalFee: 1000 });

    expect(res.status).toBe(201);
    expect(mockedOrderRepo.createSettlement).toHaveBeenCalled();
  });
});
