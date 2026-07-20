import type { ActiveStatus } from '@prisma/client';
import { customerRepository } from '../customer.repository';
import { customerService } from '../customer.service';
import type { CreateCustomerBody, ListCustomerOrdersQuery, ListCustomersQuery, UpdateCustomerBody } from '../customer.validators';

jest.mock('../customer.repository', () => ({
  customerRepository: {
    findMany: jest.fn(),
    countByStatus: jest.fn(),
    getOrderStatsByCustomerIds: jest.fn(),
    getOrderStatsForCustomer: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countOrders: jest.fn(),
    countActiveOrders: jest.fn(),
    getOrderIdsForCustomer: jest.fn(),
    sumSuccessfulDeposits: jest.fn(),
    sumSettledAmounts: jest.fn(),
    listOrders: jest.fn(),
  },
}));

const mockedRepo = customerRepository as jest.Mocked<typeof customerRepository>;

interface FakeCustomer {
  customerId: string;
  customerCode: string;
  customerName: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: ActiveStatus;
  createdAt: Date;
  updatedAt: Date;
}

function baseCustomer(overrides: Partial<FakeCustomer> = {}): FakeCustomer {
  return {
    customerId: 'c1',
    customerCode: 'c1',
    customerName: 'Nguyen Van A',
    phone: '0910000000',
    email: null,
    address: null,
    notes: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    ...overrides,
  };
}

describe('customerService.listCustomers', () => {
  it('maps ENUM status to lowercase, null email to "", and computes pagination + tab counts', async () => {
    mockedRepo.findMany.mockResolvedValue({
      rows: [baseCustomer({ customerId: 'c1', email: null }), baseCustomer({ customerId: 'c2', email: 'x@y.com', status: 'INACTIVE' })],
      totalItems: 46,
    });
    mockedRepo.countByStatus.mockResolvedValue({ all: 46, active: 40, inactive: 6 });
    mockedRepo.getOrderStatsByCustomerIds.mockResolvedValue([
      { customerId: 'c1', _count: { _all: 1 }, _sum: { totalAmount: 15000000 } },
    ] as never);

    const result = await customerService.listCustomers({ page: 1, limit: 10 } as ListCustomersQuery);

    expect(result.data[0]).toMatchObject({ customerId: 'c1', status: 'active', email: '', totalBookings: 1, totalSpent: 15000000 });
    expect(result.data[1]).toMatchObject({ customerId: 'c2', status: 'inactive', email: 'x@y.com', totalBookings: 0, totalSpent: 0 });
    expect(result.meta).toEqual({ page: 1, limit: 10, totalItems: 46, totalPages: 5, counts: { all: 46, active: 40, inactive: 6 } });
  });
});

describe('customerService.createCustomer', () => {
  it('converts empty-string email to null when writing to the DB', async () => {
    mockedRepo.create.mockResolvedValue(baseCustomer({ email: null }) as never);

    await customerService.createCustomer({ customerName: 'A', phone: '0910000000', email: '', status: 'active' } as CreateCustomerBody);

    expect(mockedRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
  });

  it('keeps a real email untouched round-trip', async () => {
    mockedRepo.create.mockResolvedValue(baseCustomer({ email: 'a@b.com' }) as never);

    const result = await customerService.createCustomer({
      customerName: 'A',
      phone: '0910000000',
      email: 'a@b.com',
      status: 'active',
    } as CreateCustomerBody);

    expect(mockedRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com' }));
    expect(result.email).toBe('a@b.com');
  });

  it('maps lowercase API status to the uppercase DB enum', async () => {
    mockedRepo.create.mockResolvedValue(baseCustomer({ status: 'INACTIVE' }) as never);

    const result = await customerService.createCustomer({
      customerName: 'A',
      phone: '0910000000',
      status: 'inactive',
    } as CreateCustomerBody);

    expect(mockedRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'INACTIVE' }));
    expect(result.status).toBe('inactive');
  });
});

describe('customerService.updateCustomer', () => {
  it('throws NOT_FOUND when the customer does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    await expect(
      customerService.updateCustomer('missing', { customerName: 'A', phone: '090', status: 'active' } as UpdateCustomerBody),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('customerService.deleteCustomer', () => {
  it('throws 404 when the customer does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    await expect(customerService.deleteCustomer('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('throws 409 CONFLICT when the customer already has orders, without deleting', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.countOrders.mockResolvedValue(2);

    await expect(customerService.deleteCustomer('c1')).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(mockedRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes when the customer has zero orders', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.countOrders.mockResolvedValue(0);

    await customerService.deleteCustomer('c1');

    expect(mockedRepo.delete).toHaveBeenCalledWith('c1');
  });
});

describe('customerService.getCustomerSummary', () => {
  it('computes paidAmount from deposits(SUCCESS) + settlements(PAID/CONFIRMED), not orders.payment_status', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.getOrderIdsForCustomer.mockResolvedValue(['o1', 'o2']);
    mockedRepo.getOrderStatsForCustomer.mockResolvedValue({ totalBookings: 2, totalSpent: 411000000 } as never);
    mockedRepo.sumSuccessfulDeposits.mockResolvedValue({ _sum: { amount: 200000000 } } as never);
    mockedRepo.sumSettledAmounts.mockResolvedValue({ _sum: { finalAmount: 211000000 } } as never);
    mockedRepo.countActiveOrders.mockResolvedValue(1);

    const result = await customerService.getCustomerSummary('c1');

    expect(result.totalValue).toBe(411000000);
    expect(result.paidAmount).toBe(411000000);
    expect(result.remainingDebt).toBe(0);
    expect(result.paymentRate).toBe(100);
    expect(result.activeOrdersCount).toBe(1);
    expect(mockedRepo.sumSuccessfulDeposits).toHaveBeenCalledWith(['o1', 'o2']);
    expect(mockedRepo.sumSettledAmounts).toHaveBeenCalledWith(['o1', 'o2']);
  });

  it('returns paymentRate 100 (not NaN/Infinity) when totalValue is 0', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.getOrderIdsForCustomer.mockResolvedValue([]);
    mockedRepo.getOrderStatsForCustomer.mockResolvedValue({ totalBookings: 0, totalSpent: 0 } as never);
    mockedRepo.sumSuccessfulDeposits.mockResolvedValue({ _sum: { amount: null } } as never);
    mockedRepo.sumSettledAmounts.mockResolvedValue({ _sum: { finalAmount: null } } as never);
    mockedRepo.countActiveOrders.mockResolvedValue(0);

    const result = await customerService.getCustomerSummary('c1');

    expect(result.totalValue).toBe(0);
    expect(result.paidAmount).toBe(0);
    expect(result.paymentRate).toBe(100);
  });
});

describe('customerService.getCustomerOrders', () => {
  it('maps order rows including the derived event label and coordinator name', async () => {
    mockedRepo.findById.mockResolvedValue(baseCustomer() as never);
    mockedRepo.listOrders.mockResolvedValue({
      rows: [
        {
          orderId: 'o1',
          eventType: 'WEDDING',
          eventName: 'Lễ cưới Nguyễn Minh Trí',
          eventDate: new Date('2026-02-23T17:00:00Z'),
          totalAmount: 411000000,
          orderStatus: 'COMPLETED',
          creator: { fullName: 'Nguyễn Văn A' },
        },
      ],
      totalItems: 1,
    } as never);

    const result = await customerService.getCustomerOrders('c1', { page: 1, limit: 6 } as ListCustomerOrdersQuery);

    expect(result.data[0]).toMatchObject({
      orderId: 'o1',
      event: 'WEDDING — Lễ cưới Nguyễn Minh Trí',
      value: 411000000,
      status: 'COMPLETED',
      coordinator: 'Nguyễn Văn A',
    });
    expect(result.meta).toEqual({ page: 1, limit: 6, totalItems: 1, totalPages: 1 });
  });
});
