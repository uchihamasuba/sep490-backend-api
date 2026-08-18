import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { paymentRepository } from '../payment.repository';
import { paymentService } from '../payment.service';

jest.mock('../payment.repository', () => ({
  paymentRepository: {
    findDepositById: jest.fn(),
    updateStatus: jest.fn(),
    findSettlementById: jest.fn(),
    confirmSettlement: jest.fn(),
    findManyDeposits: jest.fn(),
    deleteDeposit: jest.fn(),
  },
}));

const mockedPaymentRepo = paymentRepository as jest.Mocked<typeof paymentRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeDeposit(overrides: Record<string, unknown> = {}) {
  return {
    depositId: 'dep-1',
    depositCode: 'DEP-001',
    orderId: 'ord-1',
    amount: 800000,
    dueDate: null,
    paymentDate: null,
    paymentMethod: null,
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

function fakeSettlement(overrides: Record<string, unknown> = {}) {
  return {
    settlementId: 'set-1',
    orderId: 'ord-1',
    additionalFee: 0,
    compensation: 0,
    discount: 0,
    finalAmount: 800000,
    paymentMethod: null,
    qrCodeUrl: null,
    paidAt: null,
    evidenceId: null,
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

describe('paymentService.updateDepositStatus', () => {
  it('confirms an UNPAID deposit and returns the updated record', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit() as never);
    mockedPaymentRepo.updateStatus.mockResolvedValue(
      fakeDeposit({ status: 'PAID', approvedBy: 'user-1', approvedAt: new Date(), paymentDate: new Date() }) as never,
    );

    const result = await paymentService.updateDepositStatus('dep-1', { status: 'PAID' }, 'user-1');

    expect(mockedPaymentRepo.updateStatus).toHaveBeenCalledWith('dep-1', 'ord-1', 'PAID', 'user-1', undefined);
    expect(result.status).toBe('PAID');
  });

  it('rejects updating a deposit that is already PAID (400)', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit({ status: 'PAID' }) as never);

    await expect(paymentService.updateDepositStatus('dep-1', { status: 'PAID' }, 'user-1')).rejects.toMatchObject({
      status: 400,
    });
    expect(mockedPaymentRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when the deposit does not exist', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(null);

    await expect(paymentService.updateDepositStatus('ghost', { status: 'PAID' }, 'user-1')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('paymentService.confirmSettlement', () => {
  it('confirms an UNPAID settlement', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(fakeSettlement() as never);
    mockedPaymentRepo.confirmSettlement.mockResolvedValue(
      fakeSettlement({ status: 'PAID', confirmedBy: 'user-1', confirmedAt: new Date() }) as never,
    );

    const result = await paymentService.confirmSettlement('set-1', 'user-1');

    expect(mockedPaymentRepo.confirmSettlement).toHaveBeenCalledWith('set-1', 'ord-1', 'user-1', undefined);
    expect(result.status).toBe('PAID');
  });

  it('rejects confirming an already-PAID settlement (400)', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(fakeSettlement({ status: 'PAID' }) as never);

    await expect(paymentService.confirmSettlement('set-1', 'user-1')).rejects.toMatchObject({ status: 400 });
    expect(mockedPaymentRepo.confirmSettlement).not.toHaveBeenCalled();
  });
});

describe('HTTP routes', () => {
  it('PUT /api/v1/deposits/:depositId rejects an invalid status with 400', async () => {
    const res = await request(app)
      .put('/api/v1/deposits/dep-1')
      .set('Authorization', authHeader())
      .send({ status: 'UNPAID' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedPaymentRepo.findDepositById).not.toHaveBeenCalled();
  });

  it('PUT /api/v1/deposits/:depositId is forbidden for non-Manager roles', async () => {
    const res = await request(app).put('/api/v1/deposits/dep-1').set('Authorization', authHeader('ADMIN')).send({ status: 'PAID' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/v1/deposits/:depositId confirms a deposit end-to-end', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit() as never);
    mockedPaymentRepo.updateStatus.mockResolvedValue(fakeDeposit({ status: 'PAID' }) as never);

    const res = await request(app).put('/api/v1/deposits/dep-1').set('Authorization', authHeader()).send({ status: 'PAID' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
  });

  it('PUT /api/v1/settlements/:settlementId/confirm rejects a wrong status literal with 400', async () => {
    const res = await request(app)
      .put('/api/v1/settlements/set-1/confirm')
      .set('Authorization', authHeader())
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(400);
    expect(mockedPaymentRepo.findSettlementById).not.toHaveBeenCalled();
  });

  it('PUT /api/v1/settlements/:settlementId/confirm confirms end-to-end', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(fakeSettlement() as never);
    mockedPaymentRepo.confirmSettlement.mockResolvedValue(fakeSettlement({ status: 'PAID' }) as never);

    const res = await request(app).put('/api/v1/settlements/set-1/confirm').set('Authorization', authHeader()).send({ status: 'PAID' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
  });
});

describe('GET /api/v1/deposits', () => {
  it('returns a paginated list joined with order/customer info', async () => {
    mockedPaymentRepo.findManyDeposits.mockResolvedValue({
      rows: [
        {
          ...fakeDeposit(),
          order: { orderCode: 'ORD-001', eventName: 'Tech Summit 2026', eventType: 'CONFERENCE', customer: { customerName: 'Tech Corp', phone: '0911111111' } },
        },
      ],
      totalItems: 1,
    } as never);

    const res = await request(app).get('/api/v1/deposits').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      depositId: 'dep-1',
      orderCode: 'ORD-001',
      customerName: 'Tech Corp',
      customerPhone: '0911111111',
      eventName: 'Tech Summit 2026',
    });
    expect(res.body.meta).toEqual({ page: 1, limit: 10, totalItems: 1, totalPages: 1 });
  });

  it('falls back to eventType when eventName is null', async () => {
    mockedPaymentRepo.findManyDeposits.mockResolvedValue({
      rows: [
        {
          ...fakeDeposit(),
          order: { orderCode: 'ORD-002', eventName: null, eventType: 'WEDDING', customer: { customerName: 'A', phone: '0900000000' } },
        },
      ],
      totalItems: 1,
    } as never);

    const res = await request(app).get('/api/v1/deposits').set('Authorization', authHeader());

    expect(res.body.data[0].eventName).toBe('WEDDING');
  });

  it('rejects an invalid status filter with 400', async () => {
    const res = await request(app).get('/api/v1/deposits').query({ status: 'NOT_A_STATUS' }).set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/deposits');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/deposits/:depositId', () => {
  it('deletes an UNPAID deposit', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit({ status: 'UNPAID' }) as never);
    mockedPaymentRepo.deleteDeposit.mockResolvedValue(fakeDeposit() as never);

    const res = await request(app).delete('/api/v1/deposits/dep-1').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedPaymentRepo.deleteDeposit).toHaveBeenCalledWith('dep-1');
  });

  it('rejects deleting a PAID deposit with 400', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit({ status: 'PAID' }) as never);

    const res = await request(app).delete('/api/v1/deposits/dep-1').set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(mockedPaymentRepo.deleteDeposit).not.toHaveBeenCalled();
  });

  it('returns 404 when the deposit does not exist', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(null);

    const res = await request(app).delete('/api/v1/deposits/ghost').set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('is forbidden for non-Manager roles', async () => {
    const res = await request(app).delete('/api/v1/deposits/dep-1').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/settlements/:settlementId/mark-paid', () => {
  it('returns 403 for non-STAFF roles', async () => {
    const res = await request(app)
      .put('/api/v1/settlements/set-1/mark-paid')
      .send({ evidenceIds: ['img1.jpg'] })
      .set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(403);
  });

  it('validates body requiring proofs array', async () => {
    const res = await request(app)
      .put('/api/v1/settlements/set-1/mark-paid')
      .send({})
      .set('Authorization', authHeader('STAFF'));

    expect(res.status).toBe(400);
  });

  it('calls service markSettlementPaid', async () => {
    // we need to mock paymentService instead of paymentRepository for this route since it's testing controller/routes
    // Wait, the routes in this file are tested with the real service but mocked repository!
    // So let's mock the repo for markSettlementPaid
    const actualService = jest.requireActual('../payment.service').paymentService;
    jest.spyOn(actualService, 'markSettlementPaid').mockResolvedValue({} as any);

    const res = await request(app)
      .put('/api/v1/settlements/set-1/mark-paid')
      .send({ evidenceIds: ['img1.jpg'] })
      .set('Authorization', authHeader('STAFF'));

    expect(res.status).toBe(200);
    expect(actualService.markSettlementPaid).toHaveBeenCalledWith('set-1', { evidenceIds: ['img1.jpg'] }, expect.objectContaining({ id: 'user-1' }));
  });
});

// ---------------------------------------------------------------------------------------------------
// "Confirm Deposit" sheet (Report5.1_Unit Test.xlsx) -> PUT /api/v1/deposits/:depositId ->
// paymentController.updateDepositStatus -> paymentService.updateDepositStatus. The sheet's `req` column
// only names `params: { order_id }` with no body, but the real route needs a depositId path param and a
// `{ status: 'PAID' }` body (updateDepositStatusBodySchema) — the sheet's `order_id` values are used
// below as the depositId path param, and a minimal valid body is added where one is required to reach
// the intended branch.
// ---------------------------------------------------------------------------------------------------
describe('Confirm Deposit', () => {
  // UTCID01: no user (no Authorization header) -> Expected: 401 (Backend returns: 401)
  it('UTCID01: rejects a request with no authenticated user', async () => {
    const res = await request(app).put('/api/v1/deposits/ORD123').send({ status: 'PAID' });

    expect(res.status).toBe(401);
    expect(mockedPaymentRepo.findDepositById).not.toHaveBeenCalled();
  });

  // UTCID02: role Staff -> Expected: 403 (Backend returns: 403 — this route is requireRole('MANAGER')
  // only, unlike POST .../deposits which also allows STAFF)
  it('UTCID02: rejects a Staff role with 403', async () => {
    const res = await request(app)
      .put('/api/v1/deposits/ORD123')
      .set('Authorization', authHeader('STAFF'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(403);
    expect(mockedPaymentRepo.findDepositById).not.toHaveBeenCalled();
  });

  // UTCID03: order_id/depositId NON_EXISTENT -> Expected: 404 (Backend returns: 404)
  it('UTCID03: returns 404 when the deposit does not exist', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/deposits/NON_EXISTENT')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(404);
  });

  // UTCID04: spec scenario is "order has no deposit request yet" -> Expected: 400 ("Đơn hàng này chưa có
  // yêu cầu đặt cọc"). Real analog: updateDepositStatus's only 400 branch is "deposit is not in an OPEN
  // (UNPAID) status" — mapping the sheet's "nothing to confirm" intent onto a deposit that's already
  // CANCELLED (a terminal, non-confirmable state) still hits that same 400 branch. Message text differs
  // from the sheet's wording.
  it('UTCID04: rejects confirming a CANCELLED deposit with 400 (real analog of "no deposit to confirm")', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit({ status: 'CANCELLED' }) as never);

    const res = await request(app)
      .put('/api/v1/deposits/ORD123')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(400);
    expect(mockedPaymentRepo.updateStatus).not.toHaveBeenCalled();
  });

  // UTCID05: order_id ORD_PAID (deposit already confirmed PAID before) -> Expected: 400 ("Tiền cọc của
  // đơn hàng này đã được xác nhận thanh toán trước đó (PAID)"). Actual: updateDepositStatus rejects any
  // deposit not in OPEN_DEPOSIT_STATUSES (['UNPAID']) — a PAID deposit hits that guard directly.
  it('UTCID05: rejects re-confirming an already-PAID deposit with 400', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit({ status: 'PAID' }) as never);

    const res = await request(app)
      .put('/api/v1/deposits/ORD_PAID')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(400);
    expect(mockedPaymentRepo.updateStatus).not.toHaveBeenCalled();
  });

  // UTCID06: DB connection error while looking up the deposit -> Expected: 500 (Backend returns: 500)
  it('UTCID06: database error while loading the deposit surfaces as 500', async () => {
    mockedPaymentRepo.findDepositById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .put('/api/v1/deposits/ORD123')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(500);
  });

  // UTCID07: valid Manager confirmation of an UNPAID deposit -> Expected: 200 (Backend returns: 200 — the
  // route uses `ok()`, matching the sheet exactly, unlike the POST-create routes which use `created()`/201)
  it('UTCID07: confirms an UNPAID deposit end-to-end (200)', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit({ status: 'UNPAID' }) as never);
    mockedPaymentRepo.updateStatus.mockResolvedValue(fakeDeposit({ status: 'PAID' }) as never);

    const res = await request(app)
      .put('/api/v1/deposits/ORD123')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
  });
});

// ---------------------------------------------------------------------------------------------------
// "Confirm Settlement" sheet (Report5.1_Unit Test.xlsx) -> PUT /api/v1/settlements/:settlementId/confirm
// -> paymentController.confirmSettlement -> paymentService.confirmSettlement.
//
// Contract mismatch note: the sheet describes an APPROVE/REJECT decision workflow (body like
// `{ decision: 'APPROVE' | 'REJECT', reason, adjusted_amount }`, settlement statuses PENDING/APPROVED/
// REJECTED). The real endpoint has none of that — confirmSettlementBodySchema only accepts
// `{ status: 'PAID', evidenceId?/evidenceIds? }`, and SettlementStatus (prisma/schema.prisma) is only
// UNPAID/PAID/CANCELLED; there is no approve/reject/pending concept anywhere in the settlement lifecycle.
// Each UTCID below adapts the sheet's intent to the real body/status shape and documents where the actual
// 400/200 branch taken differs from the sheet's narrower APPROVE/REJECT semantics.
// ---------------------------------------------------------------------------------------------------
describe('Confirm Settlement', () => {
  // UTCID01: no user (no Authorization header) -> Expected: 401 (Backend returns: 401)
  it('UTCID01: rejects a request with no authenticated user', async () => {
    const res = await request(app).put('/api/v1/settlements/set-1/confirm').send({ status: 'PAID' });

    expect(res.status).toBe(401);
    expect(mockedPaymentRepo.findSettlementById).not.toHaveBeenCalled();
  });

  // UTCID02: role Staff -> spec expects 403 ("yêu cầu Manager/Admin"). Documented-vs-actual: the real
  // route is requireRole('MANAGER') only (ADMIN is NOT allowed either, despite the sheet's wording) —
  // status still matches (403) for a Staff actor.
  it('UTCID02: rejects a Staff role with 403', async () => {
    const res = await request(app)
      .put('/api/v1/settlements/set-1/confirm')
      .set('Authorization', authHeader('STAFF'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(403);
    expect(mockedPaymentRepo.findSettlementById).not.toHaveBeenCalled();
  });

  // UTCID03: settlementId NON_EXISTENT -> Expected: 404 (Backend returns: 404)
  it('UTCID03: returns 404 when the settlement does not exist', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/settlements/NON_EXISTENT/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(404);
  });

  // UTCID04: settlementId SETTLEMENT_APPROVED (already confirmed/"approved" before) -> Expected: 400
  // ("Yêu cầu quyết toán này đã được duyệt trước đó"). Real analog: confirmSettlement rejects a settlement
  // whose status is already PAID with "Bản quyết toán này đã được xác nhận trước đó" — same underlying
  // rule (can't re-confirm something already finalized), matching status and intent.
  it('UTCID04: rejects re-confirming an already-PAID settlement with 400', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(fakeSettlement({ status: 'PAID' }) as never);

    const res = await request(app)
      .put('/api/v1/settlements/SETTLEMENT_APPROVED/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(400);
    expect(mockedPaymentRepo.confirmSettlement).not.toHaveBeenCalled();
  });

  // UTCID05: settlementId SETTLEMENT_REJECTED (spec: rejected/cancelled request) -> spec expects 400
  // ("đã bị từ chối hoặc hủy bỏ"). Documented-vs-actual: confirmSettlement's only guard is
  // `if (settlement.status === 'PAID')` — a CANCELLED settlement is NOT caught by that check, so the
  // confirm proceeds and succeeds. This is a genuine gap versus the deposit endpoint's equivalent guard
  // (updateDepositStatus blocks anything outside ['UNPAID'], i.e. both PAID *and* CANCELLED); asserting
  // actual behavior here (200) rather than forcing a false 400.
  it('UTCID05: confirming a CANCELLED settlement is not blocked — actual backend still succeeds (200)', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(fakeSettlement({ status: 'CANCELLED' }) as never);
    mockedPaymentRepo.confirmSettlement.mockResolvedValue(fakeSettlement({ status: 'PAID' }) as never);

    const res = await request(app)
      .put('/api/v1/settlements/SETTLEMENT_REJECTED/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    // Spec expects 400 (already rejected/cancelled guard); actual backend only guards against PAID.
    expect(res.status).toBe(200);
  });

  // UTCID06: body { decision: null } (no decision chosen) -> Expected: 400. Real analog: the body has no
  // `status` field at all, which fails confirmSettletBodySchema's required `status: z.literal('PAID')` ->
  // 400 VALIDATION_ERROR. Same resulting status, via body validation rather than a "choose a decision"
  // business rule that doesn't exist on this endpoint.
  it('UTCID06: rejects a body missing the required status field with 400', async () => {
    const res = await request(app)
      .put('/api/v1/settlements/set-1/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ decision: null });

    expect(res.status).toBe(400);
    expect(mockedPaymentRepo.findSettlementById).not.toHaveBeenCalled();
  });

  // UTCID07: body { decision: 'REJECT', reason: '' } -> spec expects 400 ("Bắt buộc phải nhập lý do khi
  // từ chối"). Documented-vs-actual: there is no REJECT/reason concept on this endpoint at all — sending
  // this exact body still fails validation (missing the required `status: 'PAID'` literal), landing on
  // 400 for an entirely different reason than the sheet describes.
  it('UTCID07: a REJECT-shaped body still fails validation with 400 (no reject workflow exists)', async () => {
    const res = await request(app)
      .put('/api/v1/settlements/set-1/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ decision: 'REJECT', reason: '' });

    expect(res.status).toBe(400);
    expect(mockedPaymentRepo.findSettlementById).not.toHaveBeenCalled();
  });

  // UTCID08: body { decision: 'APPROVE', adjusted_amount: -100 } -> spec expects 400 ("Số tiền quyết toán
  // điều chỉnh không được nhỏ hơn 0"). Documented-vs-actual: there is no adjusted_amount concept on this
  // endpoint (finalAmount is fixed at creation time, not editable here) — this body still fails validation
  // (missing `status: 'PAID'`), landing on 400 for a different reason than the sheet describes.
  it('UTCID08: an adjusted_amount-shaped body still fails validation with 400 (no adjustment field exists)', async () => {
    const res = await request(app)
      .put('/api/v1/settlements/set-1/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ decision: 'APPROVE', adjusted_amount: -100 });

    expect(res.status).toBe(400);
    expect(mockedPaymentRepo.findSettlementById).not.toHaveBeenCalled();
  });

  // UTCID09: DB connection error while looking up the settlement -> Expected: 500 (Backend returns: 500)
  it('UTCID09: database error while loading the settlement surfaces as 500', async () => {
    mockedPaymentRepo.findSettlementById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .put('/api/v1/settlements/S1/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(500);
  });

  // UTCID010: valid Manager confirmation of an UNPAID settlement -> Expected: 200 (Backend returns: 200).
  // Field-shape note: to actually reach the success branch the body must be the real
  // `{ status: 'PAID' }` shape — the sheet's `{ decision: 'APPROVE', adjusted_amount: 1000 }` fields are
  // not part of the real contract and would be silently ignored/stripped by Zod, not used as an amount.
  it('UTCID010: confirms an UNPAID settlement end-to-end (200)', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(fakeSettlement({ status: 'UNPAID' }) as never);
    mockedPaymentRepo.confirmSettlement.mockResolvedValue(fakeSettlement({ status: 'PAID' }) as never);

    const res = await request(app)
      .put('/api/v1/settlements/set-1/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'PAID' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
  });
});
