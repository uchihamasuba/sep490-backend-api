import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Item } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { customerRepository } from '../customer.repository';
import { computeQuotationLines, computeQuotationTotals, quotationRepository } from '../quotation.repository';
import { quotationService } from '../quotation.service';

jest.mock('../customer.repository', () => ({
  customerRepository: { findById: jest.fn() },
}));

jest.mock('../quotation.repository', () => {
  const actual = jest.requireActual('../quotation.repository');
  return {
    ...actual,
    quotationRepository: {
      findItemsByIds: jest.fn(),
      generateNextQuotationCode: jest.fn(),
      findMany: jest.fn(),
      countByStatusGlobal: jest.fn(),
      findById: jest.fn(),
      getLinkedOrderId: jest.fn(),
      create: jest.fn(),
      replaceItems: jest.fn(),
      updateStatus: jest.fn(),
      delete: jest.fn(),
      findByCustomer: jest.fn(),
    },
  };
});

const mockedCustomerRepo = customerRepository as jest.Mocked<typeof customerRepository>;
const mockedQuotationRepo = quotationRepository as jest.Mocked<typeof quotationRepository>;

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

// Builds a fake `QuotationWithDetails` row using the REAL compute functions, so route-level
// assertions cross-check the same arithmetic the repository would actually perform.
function buildQuotationRow(params: {
  quotationId?: string;
  quotationCode?: string;
  status?: 'DRAFT' | 'APPROVED' | 'REJECTED';
  version?: string;
  items: { itemId: string; quantity: number; price: number; discount: number }[];
  itemsById: Map<string, Item>;
}) {
  const lines = computeQuotationLines(params.items, params.itemsById);
  const totals = computeQuotationTotals(lines);
  return {
    quotationId: params.quotationId ?? 'quo-1',
    quotationCode: params.quotationCode ?? 'QUO-002',
    customerId: 'cus-1',
    customer: { customerName: 'Nguyễn Minh Trí', phone: '0910000000', email: 'tri.nm@gmail.com', address: '123 Nguyễn Huệ' },
    version: params.version ?? 'v1',
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    totalAmount: totals.totalAmount,
    status: params.status ?? 'DRAFT',
    notes: null,
    creator: { userId: 'user-1', fullName: 'Project Manager', role: 'MANAGER' },
    createdAt: new Date('2026-07-20T00:00:00Z'),
    updatedAt: new Date('2026-07-20T00:00:00Z'),
    items: lines.map((line, index) => ({
      quotationItemId: `qi-${index + 1}`,
      itemId: line.itemId,
      itemName: line.itemName,
      quantity: line.quantity,
      price: line.price,
      discount: line.discount,
      lineTotal: line.lineTotal,
      item: {
        unit: params.itemsById.get(line.itemId)?.unit ?? 'Cái',
        type: { category: { categoryName: 'Âm thanh' } },
      },
    })),
  };
}

describe('computeQuotationLines / computeQuotationTotals (pure math)', () => {
  it('computes lineTotal = quantity*price - discount and rolls up subtotal/discountTotal/totalAmount', () => {
    const itemsById = new Map([
      ['item-1', fakeItem({ itemId: 'item-1', itemName: 'Loa JBL 1000W' })],
      ['item-2', fakeItem({ itemId: 'item-2', itemName: 'Đèn Beam 230' })],
    ]);

    const lines = computeQuotationLines(
      [
        { itemId: 'item-1', quantity: 2, price: 500000, discount: 50000 },
        { itemId: 'item-2', quantity: 3, price: 300000, discount: 0 },
      ],
      itemsById,
    );

    expect(lines[0].lineTotal).toBe(2 * 500000 - 50000);
    expect(lines[1].lineTotal).toBe(3 * 300000 - 0);

    const totals = computeQuotationTotals(lines);
    expect(totals).toEqual({
      subtotal: 2 * 500000 + 3 * 300000,
      discountTotal: 50000,
      totalAmount: 2 * 500000 + 3 * 300000 - 50000,
    });
  });
});

describe('quotationService.createQuotationForCustomer', () => {
  it('throws 404 when the customer does not exist', async () => {
    mockedCustomerRepo.findById.mockResolvedValue(null);

    await expect(
      quotationService.createQuotationForCustomer(
        'missing',
        { version: 'v1', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }] },
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 when an itemId does not exist in the catalog', async () => {
    mockedCustomerRepo.findById.mockResolvedValue(fakeCustomer() as never);
    mockedQuotationRepo.findItemsByIds.mockResolvedValue([]);

    await expect(
      quotationService.createQuotationForCustomer(
        'cus-1',
        { version: 'v1', items: [{ itemId: 'ghost-item', quantity: 1, price: 100, discount: 0 }] },
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' });
  });

  it('throws 400 when a line discount exceeds quantity*price (would compute a negative lineTotal)', async () => {
    mockedCustomerRepo.findById.mockResolvedValue(fakeCustomer() as never);
    mockedQuotationRepo.findItemsByIds.mockResolvedValue([fakeItem()]);

    await expect(
      quotationService.createQuotationForCustomer(
        'cus-1',
        { version: 'v1', items: [{ itemId: 'item-1', quantity: 2, price: 500000, discount: 5_000_000 }] },
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' });

    expect(mockedQuotationRepo.create).not.toHaveBeenCalled();
  });

  it('computes correct totals end to end on the happy path', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedCustomerRepo.findById.mockResolvedValue(fakeCustomer() as never);
    mockedQuotationRepo.findItemsByIds.mockResolvedValue([fakeItem()]);
    mockedQuotationRepo.generateNextQuotationCode.mockResolvedValue('QUO-002');
    mockedQuotationRepo.create.mockResolvedValue(
      buildQuotationRow({
        items: [{ itemId: 'item-1', quantity: 2, price: 500000, discount: 100000 }],
        itemsById,
      }) as never,
    );

    const result = await quotationService.createQuotationForCustomer(
      'cus-1',
      { version: 'v1', items: [{ itemId: 'item-1', quantity: 2, price: 500000, discount: 100000 }] },
      'user-1',
    );

    expect(result.subtotal).toBe(1_000_000);
    expect(result.discountTotal).toBe(100_000);
    expect(result.totalAmount).toBe(900_000);
    expect(result.items[0].lineTotal).toBe(900_000);
    expect(result.status).toBe('draft');
  });
});

describe('quotationService.updateQuotation', () => {
  it('allows editing when the quotation is DRAFT', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({ status: 'DRAFT', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );
    mockedQuotationRepo.findItemsByIds.mockResolvedValue([fakeItem()]);
    mockedQuotationRepo.replaceItems.mockResolvedValue(
      buildQuotationRow({ status: 'DRAFT', version: 'v2', items: [{ itemId: 'item-1', quantity: 5, price: 100, discount: 0 }], itemsById }) as never,
    );
    mockedQuotationRepo.getLinkedOrderId.mockResolvedValue(null);

    const result = await quotationService.updateQuotation('quo-1', {
      version: 'v2',
      items: [{ itemId: 'item-1', quantity: 5, price: 100, discount: 0 }],
    });

    expect(result.version).toBe('v2');
    expect(result.totalAmount).toBe(500);
  });

  it('allows editing an APPROVED quotation that has not been linked to an order', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({ status: 'APPROVED', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );
    mockedQuotationRepo.getLinkedOrderId.mockResolvedValue(null);
    mockedQuotationRepo.findItemsByIds.mockResolvedValue([fakeItem()]);
    mockedQuotationRepo.replaceItems.mockResolvedValue(
      buildQuotationRow({ status: 'APPROVED', version: 'v2', items: [{ itemId: 'item-1', quantity: 5, price: 100, discount: 0 }], itemsById }) as never,
    );

    const result = await quotationService.updateQuotation('quo-1', {
      version: 'v2',
      items: [{ itemId: 'item-1', quantity: 5, price: 100, discount: 0 }],
    });

    expect(result.version).toBe('v2');
    expect(result.totalAmount).toBe(500);
    expect(result.status).toBe('approved');
  });

  it('allows editing an APPROVED quotation linked to an order that is still active', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({ status: 'APPROVED', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );
    mockedQuotationRepo.getLinkedOrderId.mockResolvedValue({ orderId: 'order-1', orderStatus: 'CONFIRMED' } as never);
    mockedQuotationRepo.findItemsByIds.mockResolvedValue([fakeItem()]);
    mockedQuotationRepo.replaceItems.mockResolvedValue(
      buildQuotationRow({ status: 'APPROVED', version: 'v2', items: [{ itemId: 'item-1', quantity: 5, price: 100, discount: 0 }], itemsById }) as never,
    );

    const result = await quotationService.updateQuotation('quo-1', {
      version: 'v2',
      items: [{ itemId: 'item-1', quantity: 5, price: 100, discount: 0 }],
    });

    expect(result.version).toBe('v2');
    expect(result.linkedOrderId).toBe('order-1');
    expect(mockedQuotationRepo.replaceItems).toHaveBeenCalled();
  });

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    'blocks editing an APPROVED quotation whose linked order is %s',
    async (orderStatus) => {
      const itemsById = new Map([['item-1', fakeItem()]]);
      mockedQuotationRepo.findById.mockResolvedValue(
        buildQuotationRow({ status: 'APPROVED', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
      );
      mockedQuotationRepo.getLinkedOrderId.mockResolvedValue({ orderId: 'order-1', orderStatus } as never);

      await expect(
        quotationService.updateQuotation('quo-1', {
          version: 'v2',
          items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }],
        }),
      ).rejects.toMatchObject({ status: 400 });

      expect(mockedQuotationRepo.replaceItems).not.toHaveBeenCalled();
    },
  );

  it('blocks editing a REJECTED quotation', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({ status: 'REJECTED', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );

    await expect(
      quotationService.updateQuotation('quo-1', {
        version: 'v2',
        items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }],
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(mockedQuotationRepo.replaceItems).not.toHaveBeenCalled();
    expect(mockedQuotationRepo.getLinkedOrderId).not.toHaveBeenCalled();
  });
});

describe('quotationService.updateQuotationStatus', () => {
  it('blocks transitioning status when the quotation is not DRAFT', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({ status: 'REJECTED', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );

    await expect(quotationService.updateQuotationStatus('quo-1', 'approved')).rejects.toMatchObject({ status: 400 });
    expect(mockedQuotationRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('approves a DRAFT quotation', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({ status: 'DRAFT', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );
    mockedQuotationRepo.updateStatus.mockResolvedValue(
      buildQuotationRow({ status: 'APPROVED', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );
    mockedQuotationRepo.getLinkedOrderId.mockResolvedValue(null);

    const result = await quotationService.updateQuotationStatus('quo-1', 'approved');
    expect(result.status).toBe('approved');
    expect(mockedQuotationRepo.updateStatus).toHaveBeenCalledWith('quo-1', 'APPROVED');
  });
});

describe('quotationService.deleteQuotation', () => {
  it('rejects deleting an APPROVED quotation with 400', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({ status: 'APPROVED', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );

    await expect(quotationService.deleteQuotation('quo-1')).rejects.toMatchObject({ status: 400 });
    expect(mockedQuotationRepo.delete).not.toHaveBeenCalled();
  });

  it('allows deleting a DRAFT quotation', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({ status: 'DRAFT', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );

    await quotationService.deleteQuotation('quo-1');
    expect(mockedQuotationRepo.delete).toHaveBeenCalledWith('quo-1');
  });
});

describe('quotationService.listQuotations', () => {
  it('reports meta.counts and pagination independent of the active filters', async () => {
    mockedQuotationRepo.findMany.mockResolvedValue({
      rows: [
        {
          quotationId: 'quo-1',
          quotationCode: 'QUO-001',
          customerId: 'cus-1',
          version: 'v1',
          subtotal: 1_600_000,
          discountTotal: 0,
          totalAmount: 1_600_000,
          status: 'APPROVED',
          createdAt: new Date('2026-07-19T09:47:37.000Z'),
          customer: { customerName: 'Nguyễn Minh Trí', phone: '0910000000' },
        },
      ],
      totalItems: 124,
    } as never);
    mockedQuotationRepo.countByStatusGlobal.mockResolvedValue({
      all: 124,
      draft: 32,
      approved: 58,
      rejected: 14,
      approvedValue: 13_617_613_000,
    } as never);

    const result = await quotationService.listQuotations({ page: 1, limit: 10 } as never);

    expect(result.data[0]).toMatchObject({ quotationId: 'quo-1', code: 'QUO-001', status: 'approved' });
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      totalItems: 124,
      totalPages: 13,
      counts: { all: 124, draft: 32, approved: 58, rejected: 14, approvedValue: 13_617_613_000 },
    });
  });
});

describe('HTTP routes', () => {
  it('POST /api/v1/customers/:customerId/quotations rejects an empty items array with 400', async () => {
    const res = await request(app)
      .post('/api/v1/customers/cus-1/quotations')
      .set('Authorization', authHeader())
      .send({ version: 'v1', items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/customers/:customerId/quotations is forbidden for non-Manager roles', async () => {
    const res = await request(app)
      .post('/api/v1/customers/cus-1/quotations')
      .set('Authorization', authHeader('ADMIN'))
      .send({ version: 'v1', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }] });

    expect(res.status).toBe(403);
  });

  it('DELETE /api/v1/quotations/:quotationId returns 400 when the quotation is APPROVED', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({ status: 'APPROVED', items: [{ itemId: 'item-1', quantity: 1, price: 100, discount: 0 }], itemsById }) as never,
    );

    const res = await request(app).delete('/api/v1/quotations/quo-1').set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(mockedQuotationRepo.delete).not.toHaveBeenCalled();
  });

  it('GET /api/v1/quotations/:quotationId returns the mapped detail with items', async () => {
    const itemsById = new Map([['item-1', fakeItem()]]);
    mockedQuotationRepo.findById.mockResolvedValue(
      buildQuotationRow({
        status: 'APPROVED',
        items: [{ itemId: 'item-1', quantity: 2, price: 500000, discount: 0 }],
        itemsById,
      }) as never,
    );
    mockedQuotationRepo.getLinkedOrderId.mockResolvedValue({ orderId: 'ord-1', orderStatus: 'NEW' } as never);

    const res = await request(app).get('/api/v1/quotations/quo-1').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'approved', totalAmount: 1_000_000, linkedOrderId: 'ord-1' });
    expect(res.body.data.items[0]).toMatchObject({ itemName: 'Loa JBL 1000W', categoryName: 'Âm thanh', unit: 'Cái' });
  });
});
