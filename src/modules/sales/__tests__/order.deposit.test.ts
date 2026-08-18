import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { orderRepository } from '../order.repository';

// Only the methods createDeposit touches are mocked; everything else (scheduleRepository.isUserLeadOnOrder,
// changeRequestService.sumApprovedAmount, ...) is left as the real implementation, same pattern as
// order.lifecycle.test.ts — those hit the configured test DB with orderIds that don't exist there, which
// resolves to empty results (e.g. isUserLeadOnOrder -> false) instead of throwing.
jest.mock('../order.repository', () => {
  const actual = jest.requireActual('../order.repository');
  return {
    ...actual,
    orderRepository: {
      ...actual.orderRepository,
      findById: jest.fn(),
      generateNextDepositCode: jest.fn(),
      createDeposit: jest.fn(),
    },
  };
});

const mockedOrderRepo = orderRepository as jest.Mocked<typeof orderRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function buildOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'ORD123',
    orderCode: 'ORD-123',
    orderStatus: 'NEW',
    paymentStatus: 'UNPAID',
    totalAmount: 5_000_000,
    ...overrides,
  };
}

function buildDepositRow(overrides: Record<string, unknown> = {}) {
  return {
    depositId: 'dep-1',
    depositCode: 'DEP-001',
    orderId: 'ORD123',
    amount: 5_000_000,
    dueDate: null,
    paymentDate: null,
    paymentMethod: 'QR',
    qrCodeUrl: null,
    status: 'UNPAID',
    evidenceId: null,
    requestedBy: 'user-1',
    approvedBy: null,
    approvedAt: null,
    notes: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

describe('Generate QR Payment', () => {
  for (let i = 1; i <= 8; i++) {
    it(`UTCID0${i}: Generate QR Payment`, async () => {
      expect(1).toBe(1);
    });
  }
  // NOTE (documented-vs-actual): the "Generate QR Payment" sheet describes a standalone endpoint that
  // calls a 3rd-party VietQR API (params: { order_id, type: 'DEPOSIT' | 'SETTLEMENT' }). No such route,
  // controller, or service method exists anywhere in this codebase — grepped the whole src/ tree for
  // "qr"/"QR"/"vietqr" and the only hits are the passive `qrCodeUrl` field (a plain string the client
  // supplies in POST /orders/:orderId/deposits and POST /orders/:orderId/settlement bodies; see
  // order.validators.ts createDepositBodySchema/createSettlementBodySchema). There is no generation logic,
  // 3rd-party call, or dedicated function (generateQrPayment) to exercise, so no functional test can be
  // written against current behavior without inventing an endpoint that doesn't exist. Leaving the
  // pre-existing placeholder loop above untouched; flagging this sheet as unimplemented for the dev team.
});

// ---------------------------------------------------------------------------------------------------
// Real coverage for "Create Deposit Payment Request" (POST /orders/:orderId/deposits ->
// orderController.createDeposit -> orderService.createDeposit). Added as a second describe block with
// the same sheet name so the pre-existing placeholder loop above is left completely untouched.
// ---------------------------------------------------------------------------------------------------
describe('Create Deposit Payment Request', () => {
  // UTCID01: no user (no Authorization header) -> Expected: 401 (Backend returns: 401)
  it('UTCID01: rejects a request with no authenticated user', async () => {
    const res = await request(app).post('/api/v1/orders/ORD123/deposits').send({ amount: 5_000_000 });

    expect(res.status).toBe(401);
    expect(mockedOrderRepo.findById).not.toHaveBeenCalled();
  });

  // UTCID02: role Staff, not the LEAD of this order's plan -> Expected: 403 (Backend returns: 403).
  // Route-level guard allows STAFF (requireRole('MANAGER','STAFF')) — the Manager-only restriction is
  // enforced deeper, in orderService.createDeposit: a STAFF actor must be the LEAD on the order's plan.
  // scheduleRepository.isUserLeadOnOrder is not mocked here (real DB call) and 'ORD123' has no matching
  // schedule assignee in the test DB, so it naturally resolves to false -> forbidden.
  it('UTCID02: rejects a Staff actor who is not the plan LEAD for this order (403)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);

    const res = await request(app)
      .post('/api/v1/orders/ORD123/deposits')
      .set('Authorization', authHeader('STAFF'))
      .send({ amount: 5_000_000 });

    expect(res.status).toBe(403);
    expect(mockedOrderRepo.createDeposit).not.toHaveBeenCalled();
  });

  // UTCID03: amount: -100 -> Expected: 400 (Backend returns: 400, via createDepositBodySchema
  // amount.positive() Zod validation, before the service/repository layer is reached)
  it('UTCID03: rejects a negative amount with 400', async () => {
    const res = await request(app)
      .post('/api/v1/orders/ORD123/deposits')
      .set('Authorization', authHeader('MANAGER'))
      .send({ amount: -100 });

    expect(res.status).toBe(400);
    expect(mockedOrderRepo.findById).not.toHaveBeenCalled();
  });

  // UTCID04: order_id NON_EXISTENT -> Expected: 404 (Backend returns: 404)
  it('UTCID04: returns 404 when the order does not exist', async () => {
    mockedOrderRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/orders/NON_EXISTENT/deposits')
      .set('Authorization', authHeader('MANAGER'))
      .send({ amount: 5_000_000 });

    expect(res.status).toBe(404);
  });

  // UTCID05: order_id ORD_PAID (order already has a PAID deposit) -> spec expects 400 ("Đơn hàng này đã
  // được thanh toán tiền cọc (PAID)"). Documented-vs-actual: orderService.createDeposit has NO guard
  // against an order that already has a PAID deposit/paymentStatus — it only calls assertNotTerminal
  // (blocks COMPLETED/CANCELLED order status) and then unconditionally creates another deposit row.
  // Asserting actual behavior: a non-terminal order with paymentStatus 'PAID' still succeeds (201).
  it('UTCID05: order already has a PAID deposit — actual backend has no guard, request still succeeds (201)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ orderId: 'ORD_PAID', paymentStatus: 'PAID' }) as never);
    mockedOrderRepo.generateNextDepositCode.mockResolvedValue('DEP-002');
    mockedOrderRepo.createDeposit.mockResolvedValue(buildDepositRow({ orderId: 'ORD_PAID' }) as never);

    const res = await request(app)
      .post('/api/v1/orders/ORD_PAID/deposits')
      .set('Authorization', authHeader('MANAGER'))
      .send({ amount: 5_000_000 });

    // Spec expects 400 (already-PAID guard); actual backend has no such guard and creates the deposit.
    expect(res.status).toBe(201);
    expect(mockedOrderRepo.createDeposit).toHaveBeenCalled();
  });

  // UTCID06: spec scenario is a VietQR-partner failure ("Lỗi khi tạo mã VietQR từ hệ thống đối tác") ->
  // 500. Documented-vs-actual: createDeposit never calls a VietQR/3rd-party service (see the "Generate QR
  // Payment" note above — qrCodeUrl is just a passthrough field). The closest real analog is a failure
  // while persisting the deposit; simulating that via a rejected repository call still yields 500.
  it('UTCID06: repository failure while creating the deposit surfaces as 500', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.generateNextDepositCode.mockResolvedValue('DEP-002');
    mockedOrderRepo.createDeposit.mockRejectedValue(new Error('DB write failed'));

    const res = await request(app)
      .post('/api/v1/orders/ORD123/deposits')
      .set('Authorization', authHeader('MANAGER'))
      .send({ amount: 5_000_000 });

    expect(res.status).toBe(500);
  });

  // UTCID07: DB connection error while looking up the order -> Expected: 500 (Backend returns: 500)
  it('UTCID07: database error while loading the order surfaces as 500', async () => {
    mockedOrderRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .post('/api/v1/orders/ORD123/deposits')
      .set('Authorization', authHeader('MANAGER'))
      .send({ amount: 5_000_000 });

    expect(res.status).toBe(500);
  });

  // UTCID08: valid Manager request, amount 5,000,000 / method QR -> spec expects 200. Documented-vs-actual:
  // POST routes use utils/response.ts `created()`, which replies 201 (not 200) — asserting actual REST
  // status for a newly-created resource.
  it('UTCID08: creates the deposit end-to-end (actual status 201, spec says 200)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.generateNextDepositCode.mockResolvedValue('DEP-002');
    mockedOrderRepo.createDeposit.mockResolvedValue(
      buildDepositRow({ amount: 5_000_000, paymentMethod: 'QR' }) as never,
    );

    const res = await request(app)
      .post('/api/v1/orders/ORD123/deposits')
      .set('Authorization', authHeader('MANAGER'))
      .send({ amount: 5_000_000, paymentMethod: 'QR' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ amount: 5_000_000, paymentMethod: 'QR' });
  });
});

describe('Confirm Deposit', () => {
  for (let i = 1; i <= 7; i++) {
    it(`UTCID0${i}: Confirm Deposit`, async () => {
      expect(1).toBe(1);
    });
  }
  // NOTE: real "Confirm Deposit" coverage (PUT /api/v1/deposits/:depositId -> paymentController.
  // updateDepositStatus) lives in payment.test.ts, next to the other tests for that router — that file
  // already mocks payment.repository and exercises this exact route. See the "Confirm Deposit" describe
  // block added there.
});
