import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { orderRepository } from '../order.repository';

const prisma = new PrismaClient();

describe('order.repository integration', () => {
  let customerId: string;
  let creatorId: string;
  let orderIds: string[] = [];

  beforeAll(async () => {
    // Create a dummy customer for the orders
    const customer = await prisma.customer.create({
      data: {
        customerId: randomUUID(),
        customerCode: 'CUS-TEST',
        customerName: 'Test Customer',
        phone: '0901234567',
        email: 'test@example.com',
        address: 'Test Address',
      },
    });
    customerId = customer.customerId;

    const user = await prisma.user.create({
      data: {
        userId: randomUUID(),
        username: 'testuser' + Date.now(),
        passwordHash: 'hash',
        role: 'STAFF',
        fullName: 'Test User',
        phone: '0900000000',
        email: 'test@employee.com',
      }
    });
    creatorId = user.userId;
  });

  afterAll(async () => {
    // Clean up
    if (orderIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { orderId: { in: orderIds } } });
    }
    await prisma.customer.delete({ where: { customerId } });
    if (creatorId) {
      await prisma.user.delete({ where: { userId: creatorId } });
    }
    await prisma.$disconnect();
  });

  describe('generateNextOrderCode', () => {
    it('generates the next order code correctly even if createdAt is out of order', async () => {
      // Find what the actual last order code is in the DB currently so we can build on top of it.
      const currentHighest = await prisma.order.findFirst({
        orderBy: { orderCode: 'desc' },
        select: { orderCode: true }
      });
      let baseNum = 900;
      if (currentHighest && currentHighest.orderCode.startsWith('ORD-')) {
        const match = currentHighest.orderCode.match(/^ORD-(\d+)$/);
        if (match) {
          baseNum = parseInt(match[1], 10) + 1;
        }
      }

      const code1 = `ORD-${String(baseNum).padStart(3, '0')}`;
      const code2 = `ORD-${String(baseNum + 1).padStart(3, '0')}`;
      const code3 = `ORD-${String(baseNum + 2).padStart(3, '0')}`;
      const codeExpected = `ORD-${String(baseNum + 3).padStart(3, '0')}`;

      // 1. Generate first order
      const order1 = await prisma.order.create({
        data: {
          orderId: randomUUID(),
          orderCode: code1,
          customerId,
          eventType: 'Test',
          eventDate: new Date(),
          location: 'Test Location',
          createdBy: creatorId,
          totalAmount: 1000,
          // Set an older createdAt
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
      });
      orderIds.push(order1.orderId);

      // 2. Generate second order
      const order2 = await prisma.order.create({
        data: {
          orderId: randomUUID(),
          orderCode: code2,
          customerId,
          eventType: 'Test',
          eventDate: new Date(),
          location: 'Test Location',
          createdBy: creatorId,
          totalAmount: 1000,
          // Set a NEWER createdAt for code2
          createdAt: new Date('2026-01-01T10:05:00Z'),
        },
      });
      orderIds.push(order2.orderId);

      // 3. Generate third order
      const order3 = await prisma.order.create({
        data: {
          orderId: randomUUID(),
          orderCode: code3,
          customerId,
          eventType: 'Test',
          eventDate: new Date(),
          location: 'Test Location',
          createdBy: creatorId,
          totalAmount: 1000,
          // Set an OLDER createdAt for code3 than code2
          createdAt: new Date('2026-01-01T10:02:00Z'),
        },
      });
      orderIds.push(order3.orderId);

      const nextCode = await orderRepository.generateNextOrderCode();
      expect(nextCode).toBe(codeExpected);
    });
  });
});
