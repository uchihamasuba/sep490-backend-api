import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { orderRepository } from '../order.repository';
import { orderService } from '../order.service';
import { quotationRepository } from '../quotation.repository';

jest.mock('../quotation.repository', () => {
  const actual = jest.requireActual('../quotation.repository');
  return {
    ...actual,
    quotationRepository: {
      ...actual.quotationRepository,
      findById: jest.fn(),
      getLinkedOrderId: jest.fn(),
      countByCustomerAndStatus: jest.fn(),
    },
  };
});

jest.mock('../order.repository', () => {
  const actual = jest.requireActual('../order.repository');
  return {
    ...actual,
    orderRepository: {
      findById: jest.fn(),
      delete: jest.fn(),
      countByStatusGlobal: jest.fn(),
      findLatestSurvey: jest.fn(),
      findDeposits: jest.fn(),
      generateNextDepositCode: jest.fn(),
      createDeposit: jest.fn(),
      sumDepositsByStatus: jest.fn(),
      findLatestSettlement: jest.fn(),
      createSettlement: jest.fn(),
      updateSettlementDraft: jest.fn(),
      findOrderItem: jest.fn(),
      updateItem: jest.fn(),
      confirmPreparedQty: jest.fn(),
      updateLiveChecklist: jest.fn(),
      updateQuotationId: jest.fn(),
      close: jest.fn(),
    },
  };
});

const mockedOrderRepo = orderRepository as jest.Mocked<typeof orderRepository>;
const mockedQuotationRepo = quotationRepository as jest.Mocked<typeof quotationRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function buildOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'ord-1',
    orderCode: 'ORD-001',
    customerId: 'cus-1',
    customer: { customerName: 'Nguyễn Minh Trí', phone: '0910000000', email: 'tri.nm@gmail.com', address: '123 Nguyễn Huệ' },
    quotationId: null,
    eventType: 'Conference',
    eventName: 'Tech Summit 2026',
    eventDate: new Date('2026-08-15T09:00:00Z'),
    location: '123 Tech St. Hall A',
    guestCount: 100,
    totalAmount: 1_600_000,
    paymentStatus: 'UNPAID',
    orderStatus: 'NEW',
    cancelReason: null,
    notes: null,
    creator: { userId: 'user-1', fullName: 'Project Manager', role: 'MANAGER' },
    createdAt: new Date('2026-07-20T00:00:00Z'),
    updatedAt: new Date('2026-07-20T00:00:00Z'),
    closedAt: null,
    closedBy: null,
    liveShowChecklist: null,
    orderItems: [
      {
        orderItemId: 'oi-1',
        itemId: 'item-1',
        quantity: 2,
        unitPrice: 500000,
        subtotal: 1_000_000,
        source: 'INTERNAL',
        preparedQty: 0,
        notes: null,
        item: { itemName: 'Loa JBL 1000W', unit: 'Cái' },
      },
    ],
    ...overrides,
  };
}

describe('orderService.deleteOrder', () => {
  it('deletes a NEW order', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ orderStatus: 'NEW' }) as never);
    await orderService.deleteOrder('ord-1');
    expect(mockedOrderRepo.delete).toHaveBeenCalledWith('ord-1');
  });

  it('rejects deleting a CONFIRMED order with 400', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ orderStatus: 'CONFIRMED' }) as never);
    await expect(orderService.deleteOrder('ord-1')).rejects.toMatchObject({ status: 400 });
    expect(mockedOrderRepo.delete).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/orders/:orderId is forbidden for non-Manager roles', async () => {
    const res = await request(app).delete('/api/v1/orders/ord-1').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(403);
  });
});

describe('orderService.getOrderStats', () => {
  it('returns counts by status', async () => {
    mockedOrderRepo.countByStatusGlobal.mockResolvedValue({
      all: 5,
      new: 1,
      confirmed: 2,
      inProgress: 1,
      completed: 1,
      cancelled: 0,
    });

    const result = await orderService.getOrderStats();
    expect(result).toEqual({ all: 5, new: 1, confirmed: 2, inProgress: 1, completed: 1, cancelled: 0 });
  });

  it('GET /api/v1/orders/stats returns 200 with counts', async () => {
    mockedOrderRepo.countByStatusGlobal.mockResolvedValue({
      all: 0,
      new: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    });

    const res = await request(app).get('/api/v1/orders/stats').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ all: 0, new: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0 });
  });
});

describe('orderService.getOrderSurvey', () => {
  it('returns null when the order has no survey report', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.findLatestSurvey.mockResolvedValue(null);

    const result = await orderService.getOrderSurvey('ord-1');
    expect(result).toBeNull();
  });

  it('maps the latest survey report', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.findLatestSurvey.mockResolvedValue({
      surveyId: 'sur-1',
      reportCode: 'SUR-001',
      status: 'CONFIRMED',
      surveyDate: new Date('2026-07-01T00:00:00Z'),
      location: 'Hall A',
      reporter: { fullName: 'Leader A' },
      confirmer: { fullName: 'Manager A' },
      confirmedAt: new Date('2026-07-02T00:00:00Z'),
    } as never);

    const result = await orderService.getOrderSurvey('ord-1');
    expect(result).toMatchObject({ surveyId: 'sur-1', status: 'CONFIRMED', reportedByName: 'Leader A', confirmedByName: 'Manager A' });
  });
});

describe('orderService.getOrderDeposits / getOrderSettlement', () => {
  it('maps deposits list', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.findDeposits.mockResolvedValue([
      {
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
      },
    ] as never);

    const result = await orderService.getOrderDeposits('ord-1');
    expect(result).toEqual([expect.objectContaining({ depositId: 'dep-1', amount: 800000, status: 'PENDING' })]);
  });

  it('returns null settlement when none exists', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.findLatestSettlement.mockResolvedValue(null);

    const result = await orderService.getOrderSettlement('ord-1');
    expect(result).toBeNull();
  });
});

describe('orderService.updateOrderItem', () => {
  it('rejects when the order item does not belong to the order (404)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.findOrderItem.mockResolvedValue(null);

    await expect(orderService.updateOrderItem('ord-1', 'oi-ghost', { notes: 'x' } as never)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('PATCH /orders/:orderId/items/:orderItemId rejects empty body with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/orders/ord-1/items/oi-1')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedOrderRepo.findById).not.toHaveBeenCalled();
  });
});

describe('orderService.updateLiveChecklist', () => {
  it('merges the checklist key onto defaults when none exists yet', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ liveShowChecklist: null }) as never);
    mockedOrderRepo.updateLiveChecklist.mockResolvedValue(
      buildOrderRow({ liveShowChecklist: { backdrop: true, soundTest: false, powerBackup: false, operatorReady: false } }) as never,
    );

    const result = await orderService.updateLiveChecklist('ord-1', { key: 'backdrop', checked: true });

    expect(mockedOrderRepo.updateLiveChecklist).toHaveBeenCalledWith('ord-1', {
      backdrop: true,
      soundTest: false,
      powerBackup: false,
      operatorReady: false,
    });
    expect(result.backdrop).toBe(true);
  });

  it('PATCH /orders/:orderId/live-checklist rejects an invalid key with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/orders/ord-1/live-checklist')
      .set('Authorization', authHeader())
      .send({ key: 'unknownKey', checked: true });

    expect(res.status).toBe(400);
  });
});

describe('orderService.updateOrderQuotation', () => {
  it('links an APPROVED quotation not already linked elsewhere', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ quotationId: null }) as never);
    mockedQuotationRepo.findById.mockResolvedValue({ quotationId: 'quo-1', status: 'APPROVED' } as never);
    mockedQuotationRepo.getLinkedOrderId.mockResolvedValue(null);
    mockedOrderRepo.updateQuotationId.mockResolvedValue(buildOrderRow({ quotationId: 'quo-1' }) as never);

    const result = await orderService.updateOrderQuotation('ord-1', { quotationId: 'quo-1' });
    expect(result.quotationId).toBe('quo-1');
  });

  it('rejects linking a quotation already linked to a different order (409)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ quotationId: null }) as never);
    mockedQuotationRepo.findById.mockResolvedValue({ quotationId: 'quo-1', status: 'APPROVED' } as never);
    mockedQuotationRepo.getLinkedOrderId.mockResolvedValue({ orderId: 'ord-other' } as never);

    await expect(orderService.updateOrderQuotation('ord-1', { quotationId: 'quo-1' })).rejects.toMatchObject({ status: 409 });
  });

  it('rejects unlinking when the customer has only 1 APPROVED quotation (400)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ quotationId: 'quo-1', customerId: 'cus-1' }) as never);
    mockedQuotationRepo.countByCustomerAndStatus.mockResolvedValue(1);

    await expect(orderService.updateOrderQuotation('ord-1', { quotationId: null })).rejects.toMatchObject({ status: 400 });
    expect(mockedOrderRepo.updateQuotationId).not.toHaveBeenCalled();
  });

  it('allows unlinking when the customer has > 1 APPROVED quotations', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ quotationId: 'quo-1', customerId: 'cus-1' }) as never);
    mockedQuotationRepo.countByCustomerAndStatus.mockResolvedValue(2);
    mockedOrderRepo.updateQuotationId.mockResolvedValue(buildOrderRow({ quotationId: null }) as never);

    const result = await orderService.updateOrderQuotation('ord-1', { quotationId: null });
    expect(result.quotationId).toBeNull();
  });
});

describe('orderService.createDeposit / createSettlement', () => {
  it('creates a deposit request for a non-terminal order', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ orderStatus: 'CONFIRMED' }) as never);
    mockedOrderRepo.generateNextDepositCode.mockResolvedValue('DEP-002');
    mockedOrderRepo.createDeposit.mockResolvedValue({
      depositId: 'dep-2',
      depositCode: 'DEP-002',
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
      createdAt: new Date('2026-07-20T00:00:00Z'),
      updatedAt: new Date('2026-07-20T00:00:00Z'),
    } as never);

    const result = await orderService.createDeposit('ord-1', { amount: 800000 } as never, 'user-1');
    expect(result).toMatchObject({ depositId: 'dep-2', depositCode: 'DEP-002', amount: 800000 });
  });

  it('POST /orders/:orderId/deposits rejects amount <= 0 with 400', async () => {
    const res = await request(app)
      .post('/api/v1/orders/ord-1/deposits')
      .set('Authorization', authHeader())
      .send({ amount: 0 });

    expect(res.status).toBe(400);
    expect(mockedOrderRepo.findById).not.toHaveBeenCalled();
  });

  it('computes finalAmount server-side from totalAmount + fees - successful deposits - discount', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ totalAmount: 1_600_000 }) as never);
    mockedOrderRepo.sumDepositsByStatus.mockResolvedValue({ _sum: { amount: 800000 } } as never);
    mockedOrderRepo.findLatestSettlement.mockResolvedValue(null);
    (mockedOrderRepo.createSettlement as jest.Mock).mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve({ settlementId: 'set-1', ...data, status: 'DRAFT' }),
    );

    const result = await orderService.createSettlement(
      'ord-1',
      { additionalFee: 100000, compensation: 0, discount: 50000 } as never,
      'user-1',
    );

    expect(result).toEqual({ settlementId: 'set-1' });
    expect(mockedOrderRepo.createSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ finalAmount: 1_600_000 + 100000 + 0 - 50000 - 800000 }),
    );
  });

  it('updates an existing DRAFT settlement instead of creating a new one', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ totalAmount: 1_600_000 }) as never);
    mockedOrderRepo.sumDepositsByStatus.mockResolvedValue({ _sum: { amount: 0 } } as never);
    mockedOrderRepo.findLatestSettlement.mockResolvedValue({ settlementId: 'set-1', status: 'DRAFT' } as never);
    mockedOrderRepo.updateSettlementDraft.mockResolvedValue({ settlementId: 'set-1', status: 'DRAFT' } as never);

    await orderService.createSettlement('ord-1', { additionalFee: 0, compensation: 0, discount: 0 } as never, 'user-1');

    expect(mockedOrderRepo.updateSettlementDraft).toHaveBeenCalledWith('set-1', expect.any(Object));
    expect(mockedOrderRepo.createSettlement).not.toHaveBeenCalled();
  });
});

describe('orderService.closeOrder', () => {
  it('rejects closing an order that is not COMPLETED + PAID', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ orderStatus: 'IN_PROGRESS', paymentStatus: 'DEPOSITED' }) as never);

    await expect(orderService.closeOrder('ord-1', 'user-1', {})).rejects.toMatchObject({ status: 400 });
    expect(mockedOrderRepo.close).not.toHaveBeenCalled();
  });

  it('rejects closing an already-closed order', async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      buildOrderRow({ orderStatus: 'COMPLETED', paymentStatus: 'PAID', closedAt: new Date('2026-07-01T00:00:00Z') }) as never,
    );

    await expect(orderService.closeOrder('ord-1', 'user-1', {})).rejects.toMatchObject({ status: 400 });
  });

  it('closes a COMPLETED + PAID order', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow({ orderStatus: 'COMPLETED', paymentStatus: 'PAID' }) as never);
    mockedOrderRepo.close.mockResolvedValue(
      buildOrderRow({ orderStatus: 'COMPLETED', paymentStatus: 'PAID', closedAt: new Date('2026-07-20T00:00:00Z'), closedBy: 'user-1' }) as never,
    );

    const result = await orderService.closeOrder('ord-1', 'user-1', {});
    expect(result.closedBy).toBe('user-1');
    expect(mockedOrderRepo.close).toHaveBeenCalledWith('ord-1', 'user-1');
  });
});

describe('orderService.confirmPreparedItems', () => {
  it('rejects orderItemId not belonging to the order (400)', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);

    await expect(
      orderService.confirmPreparedItems('ord-1', { items: [{ orderItemId: 'oi-ghost', preparedQty: 1 }] }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockedOrderRepo.confirmPreparedQty).not.toHaveBeenCalled();
  });

  it('confirms prepared quantities for valid order items', async () => {
    mockedOrderRepo.findById.mockResolvedValue(buildOrderRow() as never);
    mockedOrderRepo.confirmPreparedQty.mockResolvedValue(
      buildOrderRow({ orderItems: [{ ...buildOrderRow().orderItems[0], preparedQty: 2 }] }) as never,
    );

    const result = await orderService.confirmPreparedItems('ord-1', { items: [{ orderItemId: 'oi-1', preparedQty: 2 }] });
    expect(result.items[0].preparedQty).toBe(2);
    expect(mockedOrderRepo.confirmPreparedQty).toHaveBeenCalledWith('ord-1', [{ orderItemId: 'oi-1', preparedQty: 2 }]);
  });

  it('PUT /orders/:orderId/items/confirm-prepared rejects empty items with 400', async () => {
    const res = await request(app)
      .put('/api/v1/orders/ord-1/items/confirm-prepared')
      .set('Authorization', authHeader())
      .send({ items: [] });

    expect(res.status).toBe(400);
  });
});
