import { reservationRepository, orderWindow, SETUP_BUFFER_HOURS, TURNAROUND_DAYS } from '../reservation.repository';

jest.mock('../../../db/prisma', () => ({
  prisma: {
    inventoryReservation: { aggregate: jest.fn() },
    inventoryMovement: { groupBy: jest.fn() },
    inventory: { findUnique: jest.fn() },
  },
}));

import { prisma } from '../../../db/prisma';

const mocked = prisma as unknown as {
  inventoryReservation: { aggregate: jest.Mock };
  inventoryMovement: { groupBy: jest.Mock };
  inventory: { findUnique: jest.Mock };
};

beforeEach(() => jest.clearAllMocks());

describe('orderWindow', () => {
  it('mở rộng cửa sổ = [eventDate − setupBuffer, endDate + turnaround]', () => {
    const ev = new Date('2026-09-10T09:00:00.000Z');
    const end = new Date('2026-09-11T22:00:00.000Z');
    const w = orderWindow(ev, end);
    expect(w.startAt.getTime()).toBe(ev.getTime() - SETUP_BUFFER_HOURS * 3_600_000);
    expect(w.endAt.getTime()).toBe(end.getTime() + TURNAROUND_DAYS * 86_400_000);
  });

  it('endDate null → dùng eventDate làm mốc kết thúc', () => {
    const ev = new Date('2026-09-10T09:00:00.000Z');
    const w = orderWindow(ev, null);
    expect(w.endAt.getTime()).toBe(ev.getTime() + TURNAROUND_DAYS * 86_400_000);
  });
});

describe('reservationRepository.getReservedForRange', () => {
  it('tổng CONFIRMED chồng khoảng, loại trừ đơn chỉ định (điều kiện overlap đúng)', async () => {
    mocked.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 7 } });
    const start = new Date('2026-09-10T00:00:00Z');
    const end = new Date('2026-09-12T00:00:00Z');

    const res = await reservationRepository.getReservedForRange('item-1', start, end, { excludeOrderId: 'ord-x' });

    expect(res).toBe(7);
    const arg = mocked.inventoryReservation.aggregate.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      itemId: 'item-1',
      status: { in: ['CONFIRMED'] },
      startAt: { lt: end }, // overlap: A.start < B.end && A.end > B.start
      endAt: { gt: start },
      orderId: { not: 'ord-x' },
    });
  });

  it('không có reservation → trả 0', async () => {
    mocked.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: null } });
    expect(await reservationRepository.getReservedForRange('i', new Date(), new Date())).toBe(0);
  });
});

describe('reservationRepository.getOnHandNow', () => {
  it('= total − damaged − (ΣOUTBOUND − ΣINBOUND)', async () => {
    mocked.inventory.findUnique.mockResolvedValue({ quantityTotal: 10, quantityDamaged: 1 });
    mocked.inventoryMovement.groupBy.mockResolvedValue([
      { movementType: 'OUTBOUND', _sum: { quantity: 4 } },
      { movementType: 'INBOUND', _sum: { quantity: 1 } },
    ]);
    // đang ngoài kho = 4 − 1 = 3; on-hand = 10 − 1 − 3 = 6
    expect(await reservationRepository.getOnHandNow('item-1')).toBe(6);
  });

  it('không có dòng inventory → 0', async () => {
    mocked.inventory.findUnique.mockResolvedValue(null);
    expect(await reservationRepository.getOnHandNow('x')).toBe(0);
  });
});

describe('reservationRepository.getAvailableForRange', () => {
  it('= total − damaged − reserved(range)', async () => {
    mocked.inventory.findUnique.mockResolvedValue({ quantityTotal: 8, quantityDamaged: 0 });
    mocked.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 5 } });
    expect(await reservationRepository.getAvailableForRange('item-1', new Date(), new Date())).toBe(3);
  });
});
