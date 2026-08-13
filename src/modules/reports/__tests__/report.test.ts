import request from 'supertest';
import express from 'express';
import { reportRouter } from '../report.routes';
import { reportRepository } from '../report.repository';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';
import { errorHandler } from '../../../middleware/error';

jest.mock('../report.repository', () => ({
  reportRepository: {
    getCommittedOrders: jest.fn(),
    getRelatedSupplierTransactions: jest.fn(),
    getRelatedDeposits: jest.fn(),
    getRelatedSettlements: jest.fn(),
    getPaidDepositsInPeriod: jest.fn(),
    getPaidSettlementsInPeriod: jest.fn(),
    getSupplierTransactionsInPeriod: jest.fn(),
    getCompletedOrders: jest.fn(),
  },
}));

const mockedRepo = reportRepository as jest.Mocked<typeof reportRepository>;

function authHeader(role: 'ADMIN' | 'MANAGER' | 'STAFF', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

const app = express();
app.use(express.json());
app.use('/api/v1/reports', reportRouter);
app.use(errorHandler);

describe('Report Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockedRepo.getCommittedOrders.mockResolvedValue([]);
    mockedRepo.getRelatedSupplierTransactions.mockResolvedValue([]);
    mockedRepo.getRelatedDeposits.mockResolvedValue([]);
    mockedRepo.getRelatedSettlements.mockResolvedValue([]);
    mockedRepo.getPaidDepositsInPeriod.mockResolvedValue([]);
    mockedRepo.getPaidSettlementsInPeriod.mockResolvedValue([]);
    mockedRepo.getSupplierTransactionsInPeriod.mockResolvedValue([]);
    mockedRepo.getCompletedOrders.mockResolvedValue([]);
  });

  describe('GET /api/v1/reports/revenue', () => {
    describe('Permissions & Authentication', () => {
      it('returns 401 when no token is provided', async () => {
        const res = await request(app).get('/api/v1/reports/revenue?startDate=2026-01-01&endDate=2026-12-31');
        expect(res.status).toBe(401);
      });

      it('returns 403 when user is STAFF (not allowed)', async () => {
        const res = await request(app)
          .get('/api/v1/reports/revenue?startDate=2026-01-01&endDate=2026-12-31')
          .set('Authorization', authHeader('STAFF'));
        expect(res.status).toBe(403);
      });

      it.each(['ADMIN', 'MANAGER'] as const)(
        'allows %s to access the report',
        async (role) => {
          const res = await request(app)
            .get('/api/v1/reports/revenue?startDate=2026-01-01&endDate=2026-12-31')
            .set('Authorization', authHeader(role));
          expect(res.status).toBe(200);
        }
      );
    });

    describe('Validation', () => {
      const cases = [
        { name: 'missing startDate', query: 'endDate=2026-12-31', expected: 400 },
        { name: 'missing endDate', query: 'startDate=2026-01-01', expected: 400 },
        { name: 'empty startDate', query: 'startDate=&endDate=2026-12-31', expected: 400 },
        { name: 'empty endDate', query: 'startDate=2026-01-01&endDate=', expected: 400 },
        { name: 'invalid startDate format', query: 'startDate=abc&endDate=2026-12-31', expected: 400 },
        { name: 'invalid endDate format', query: 'startDate=2026-01-01&endDate=def', expected: 400 },
        { name: 'startDate after endDate', query: 'startDate=2026-12-31&endDate=2026-01-01', expected: 400 },
      ];

      it.each(cases)('returns $expected when $name', async ({ query, expected }) => {
        const res = await request(app)
          .get(`/api/v1/reports/revenue?${query}`)
          .set('Authorization', authHeader('ADMIN'));
        expect(res.status).toBe(expected);
      });
    });

    describe('Business Logic & Aggregation', () => {
      it('aggregates P&L correctly when data is empty', async () => {
        const res = await request(app)
          .get('/api/v1/reports/revenue?startDate=2026-01-01&endDate=2026-12-31')
          .set('Authorization', authHeader('ADMIN'));
          
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.profitability.committed).toBe(0);
        expect(res.body.data.profitability.collected).toBe(0);
        expect(res.body.data.profitability.supplierCost).toBe(0);
      });

      it('aggregates orders and supplier transactions correctly', async () => {
        mockedRepo.getCommittedOrders.mockResolvedValue([
          {
            orderId: 'o1',
            orderCode: 'ORD-001',
            customerId: 'c1',
            eventDate: new Date('2026-05-15T10:00:00Z'),
            totalAmount: 10000,
            orderStatus: 'COMPLETED',
            customer: { customerName: 'John Doe' },
            eventType: 'Wedding',
          } as any,
          {
            orderId: 'o2',
            orderCode: 'ORD-002',
            customerId: 'c1',
            eventDate: new Date('2026-05-20T10:00:00Z'),
            totalAmount: 5000,
            orderStatus: 'CONFIRMED',
            customer: { customerName: 'John Doe' },
            eventType: 'Conference',
          } as any
        ]);

        mockedRepo.getRelatedSupplierTransactions.mockResolvedValue([
          { orderId: 'o1', estimatedCost: 2000 } as any,
          { orderId: 'o2', estimatedCost: 1000 } as any,
        ]);

        mockedRepo.getRelatedDeposits.mockResolvedValue([
          { orderId: 'o1', amount: 5000 } as any,
          { orderId: 'o2', amount: 2500 } as any,
        ]);

        mockedRepo.getRelatedSettlements.mockResolvedValue([
          { orderId: 'o1', finalAmount: 5000 } as any,
        ]);

        const res = await request(app)
          .get('/api/v1/reports/revenue?startDate=2026-01-01&endDate=2026-12-31')
          .set('Authorization', authHeader('ADMIN'));

        expect(res.status).toBe(200);
        const data = res.body.data;
        
        // P&L
        expect(data.profitability.committed).toBe(15000); // 10k + 5k
        expect(data.profitability.collected).toBe(12500); // (5k+5k) + 2.5k
        expect(data.profitability.supplierCost).toBe(3000); // 2000 + 1000
        expect(data.profitability.orderCount).toBe(2);
        expect(data.profitability.completedCount).toBe(1);

        // Chart Data (monthly)
        expect(data.profitability.monthly.length).toBeGreaterThan(0);
        const may2026 = data.profitability.monthly.find((m: any) => m.month === '05/2026');
        expect(may2026).toBeDefined();
        expect(may2026.committed).toBe(15000);
        expect(may2026.collected).toBe(12500);

        // Top Customers
        expect(data.profitability.topCustomers).toHaveLength(1);
        expect(data.profitability.topCustomers[0].name).toBe('John Doe');
        expect(data.profitability.topCustomers[0].revenue).toBe(15000);
      });
    });
  });
});
