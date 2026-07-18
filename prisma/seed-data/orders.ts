// Trích xuất/tái sinh từ sep490-web-frontend/src/mocks/db/orders.ts (generateMockOrders) — cũng là
// dữ liệu SINH bằng công thức xác định (không phải mảng tĩnh), lặp lại đúng công thức + 2 pool phụ
// thuộc (VENUE_POOL ở db/quotations.ts, COORDINATOR_POOL ở db/employees.ts) để ra đúng 64 đơn
// DD0001..DD0064 khớp UI. `eventType`/`eventName` theo đúng quy ước mockAdapter.ts đang trả về
// (mapOrderToApi: eventType cố định 'Đám cưới', eventName = `Lễ cưới ${customerName}`).
//
// CHỈ seed phần HEADER của `orders` (khớp cột trong docs/TABLES.md). KHÔNG seed `order_items` — line
// item của mock (`AdminOrderLineItem`, vd "Tiệc bàn"/"Trang trí sảnh"/"MC & âm thanh"/"Quay phim") là
// các GÓI DỊCH VỤ tự do, không tham chiếu `item_id` thật nào trong catalog (`items`), trong khi
// order_items.item_id là FK bắt buộc (NOT NULL) tới `items` — không có cách map trung thực mà không
// bịa dữ liệu. `checklist`/`liveChecklist`/`disputeLogs`/`quotationId` cũng không có cột tương ứng
// trong `orders` (docs/TABLES.md) nên bỏ qua. `quotation_id`/`policy_id` để null (chưa seed
// quotations ở Task 2.1).
//
// `created_by`: gán cố định user Manager (mock-manager-1) — đúng vai trò "Người tạo (Manager)" theo
// docs/TABLES.md, khác `coordinatorName` (điều phối viên hiện trường) trong mock vốn không phải FK
// user thật.

import { CUSTOMERS, type CustomerSeed } from './customers';

export type OrderPaymentStatus = 'UNPAID' | 'DEPOSITED' | 'PAID';
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface OrderSeed {
  orderId: string;
  orderCode: string;
  customerId: string;
  eventType: string;
  eventName: string;
  eventDate: string; // ISO datetime
  location: string;
  guestCount: number;
  totalAmount: number;
  paymentStatus: OrderPaymentStatus;
  orderStatus: OrderStatus;
  notes: string;
  createdBy: string;
}

const REFERENCE_TODAY = new Date('2026-07-10');

const VENUE_POOL = [
  'Riverside Palace (Sảnh Hera)', 'White Palace (Sảnh Rose)', 'Diamond Center (Sảnh Kim Cương)',
  'Grand Palace (Sảnh Ngọc)', 'Rex Hotel (Sảnh Hoàng Gia)', 'Adora Center (Sảnh Adora)',
];

const CREATED_BY_MANAGER = 'mock-manager-1';

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function derivePaymentStatus(status: OrderStatus, index: number): OrderPaymentStatus {
  if (status === 'COMPLETED') return 'PAID';
  if (status === 'CANCELLED') return 'UNPAID';
  if (status === 'IN_PROGRESS') return index % 4 === 0 ? 'PAID' : 'DEPOSITED';
  if (status === 'CONFIRMED') return index % 3 === 0 ? 'UNPAID' : 'DEPOSITED';
  return 'UNPAID';
}

function generateOrders(customers: CustomerSeed[]): OrderSeed[] {
  const statusSequence: OrderStatus[] = [
    ...Array(10).fill('NEW'),
    ...Array(12).fill('CONFIRMED'),
    ...Array(20).fill('IN_PROGRESS'),
    ...Array(16).fill('COMPLETED'),
    ...Array(6).fill('CANCELLED'),
  ];

  return statusSequence.map((status, index) => {
    const customer = customers[index % customers.length];
    const guestCount = 150 + ((index * 41) % 350);
    const totalPrice = 180_000_000 + ((index * 15_500_000) % 420_000_000);
    const dayOffset = status === 'COMPLETED' ? -(10 + index * 3) : 5 + index * 3;
    const venue = VENUE_POOL[index % VENUE_POOL.length];
    const orderId = `DD${String(index + 1).padStart(4, '0')}`;

    return {
      orderId,
      orderCode: orderId,
      customerId: customer.customerId,
      eventType: 'Đám cưới',
      eventName: `Lễ cưới ${customer.customerName}`,
      eventDate: `${addDays(REFERENCE_TODAY, dayOffset)}T00:00:00Z`,
      location: venue,
      guestCount,
      totalAmount: totalPrice,
      paymentStatus: derivePaymentStatus(status, index),
      orderStatus: status,
      notes: index % 4 === 0 ? 'Khách yêu cầu trang trí tông màu pastel, có khu vực chụp ảnh riêng.' : '',
      createdBy: CREATED_BY_MANAGER,
    };
  });
}

export const ORDERS: OrderSeed[] = generateOrders(CUSTOMERS);
