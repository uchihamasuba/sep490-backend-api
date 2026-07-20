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
  },
}));

const mockedPaymentRepo = paymentRepository as jest.Mocked<typeof paymentRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
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
    status: 'PENDING',
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
    status: 'DRAFT',
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
  it('confirms a PENDING deposit and returns the updated record', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit() as never);
    mockedPaymentRepo.updateStatus.mockResolvedValue(
      fakeDeposit({ status: 'SUCCESS', approvedBy: 'user-1', approvedAt: new Date(), paymentDate: new Date() }) as never,
    );

    const result = await paymentService.updateDepositStatus('dep-1', { status: 'SUCCESS' }, 'user-1');

    expect(mockedPaymentRepo.updateStatus).toHaveBeenCalledWith('dep-1', 'ord-1', 'SUCCESS', 'user-1');
    expect(result.status).toBe('SUCCESS');
  });

  it('rejects updating a deposit that is already SUCCESS (400)', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit({ status: 'SUCCESS' }) as never);

    await expect(paymentService.updateDepositStatus('dep-1', { status: 'SUCCESS' }, 'user-1')).rejects.toMatchObject({
      status: 400,
    });
    expect(mockedPaymentRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when the deposit does not exist', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(null);

    await expect(paymentService.updateDepositStatus('ghost', { status: 'SUCCESS' }, 'user-1')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('paymentService.confirmSettlement', () => {
  it('confirms a DRAFT settlement', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(fakeSettlement() as never);
    mockedPaymentRepo.confirmSettlement.mockResolvedValue(
      fakeSettlement({ status: 'CONFIRMED', confirmedBy: 'user-1', confirmedAt: new Date() }) as never,
    );

    const result = await paymentService.confirmSettlement('set-1', 'user-1');

    expect(mockedPaymentRepo.confirmSettlement).toHaveBeenCalledWith('set-1', 'user-1');
    expect(result.status).toBe('CONFIRMED');
  });

  it('rejects confirming an already-CONFIRMED settlement (400)', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(fakeSettlement({ status: 'CONFIRMED' }) as never);

    await expect(paymentService.confirmSettlement('set-1', 'user-1')).rejects.toMatchObject({ status: 400 });
    expect(mockedPaymentRepo.confirmSettlement).not.toHaveBeenCalled();
  });
});

describe('HTTP routes', () => {
  it('PUT /api/v1/deposits/:depositId rejects an invalid status with 400', async () => {
    const res = await request(app)
      .put('/api/v1/deposits/dep-1')
      .set('Authorization', authHeader())
      .send({ status: 'PENDING' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedPaymentRepo.findDepositById).not.toHaveBeenCalled();
  });

  it('PUT /api/v1/deposits/:depositId is forbidden for non-Manager roles', async () => {
    const res = await request(app).put('/api/v1/deposits/dep-1').set('Authorization', authHeader('ADMIN')).send({ status: 'SUCCESS' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/v1/deposits/:depositId confirms a deposit end-to-end', async () => {
    mockedPaymentRepo.findDepositById.mockResolvedValue(fakeDeposit() as never);
    mockedPaymentRepo.updateStatus.mockResolvedValue(fakeDeposit({ status: 'SUCCESS' }) as never);

    const res = await request(app).put('/api/v1/deposits/dep-1').set('Authorization', authHeader()).send({ status: 'SUCCESS' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUCCESS');
  });

  it('PUT /api/v1/settlements/:settlementId/confirm rejects a wrong status literal with 400', async () => {
    const res = await request(app)
      .put('/api/v1/settlements/set-1/confirm')
      .set('Authorization', authHeader())
      .send({ status: 'PAID' });

    expect(res.status).toBe(400);
    expect(mockedPaymentRepo.findSettlementById).not.toHaveBeenCalled();
  });

  it('PUT /api/v1/settlements/:settlementId/confirm confirms end-to-end', async () => {
    mockedPaymentRepo.findSettlementById.mockResolvedValue(fakeSettlement() as never);
    mockedPaymentRepo.confirmSettlement.mockResolvedValue(fakeSettlement({ status: 'CONFIRMED' }) as never);

    const res = await request(app).put('/api/v1/settlements/set-1/confirm').set('Authorization', authHeader()).send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
  });
});
