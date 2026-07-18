// Trích xuất/tái sinh từ sep490-web-frontend/src/mocks/db/customers.ts (generateMockCustomers) —
// dữ liệu customer ở đó được SINH bằng công thức xác định (deterministic) từ NAME_POOL/ADDRESS_POOL/
// NOTES_POOL, không phải mảng tĩnh — nên lặp lại chính xác cùng công thức để ra đúng 42 khách hàng
// KH001..KH042 khớp với những gì UI đang hiển thị.

export interface CustomerSeed {
  customerId: string;
  customerCode: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const NAME_POOL = [
  'Nguyễn Minh Trí', 'Trần Thu Thảo', 'Phạm Hải Nam', 'Đỗ Anh Khoa', 'Vũ Ngọc Lan',
  'Hoàng Gia Bảo', 'Bùi Thanh Hà', 'Ngô Quốc Huy', 'Lý Diễm My', 'Đặng Văn Phúc',
  'Phan Thảo Vy', 'Trương Đình Khang', 'Mai Thu Hương', 'Đinh Công Danh', 'Lâm Bảo Châu',
  'Cao Xuân Sơn', 'Tô Kim Ngân', 'Dương Nhật Minh', 'Huỳnh Gia Hân', 'Vương Đức Anh',
];

const ADDRESS_POOL = [
  '123 Nguyễn Huệ, P. Bến Nghé, Q.1, TP. Hồ Chí Minh',
  '45 Lê Lợi, P. Bến Thành, Q.1, TP. Hồ Chí Minh',
  '78 Nguyễn Văn Cừ, P.4, Q.5, TP. Hồ Chí Minh',
  '12 Hoàng Diệu, P. Linh Trung, TP. Thủ Đức',
  '256 Cách Mạng Tháng 8, Q.3, TP. Hồ Chí Minh',
  '89 Điện Biên Phủ, Q. Bình Thạnh, TP. Hồ Chí Minh',
];

const NOTES_POOL = [
  'Khách quen, ưu tiên tư vấn gói cao cấp.',
  'Yêu cầu liên hệ qua Zalo thay vì gọi điện.',
  'Đã từng đặt tiệc sinh nhật, hài lòng về dịch vụ.',
  '',
  '',
];

function slugifyEmail(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase()
    .split(/\s+/);
  const last = normalized[normalized.length - 1] ?? 'khach';
  const initials = normalized.slice(0, -1).map((p) => p[0]).join('');
  return `${last}.${initials}@gmail.com`;
}

function generateCustomers(): CustomerSeed[] {
  return Array.from({ length: 42 }, (_, i) => {
    const name = NAME_POOL[i % NAME_POOL.length];
    const isInactive = i % 7 === 0;
    const customerId = `KH${String(i + 1).padStart(3, '0')}`;
    return {
      customerId,
      customerCode: customerId,
      customerName: i >= NAME_POOL.length ? `${name} ${Math.floor(i / NAME_POOL.length) + 1}` : name,
      phone: `09${String(10_000_000 + i * 173).slice(0, 8)}`,
      email: slugifyEmail(name),
      address: ADDRESS_POOL[i % ADDRESS_POOL.length],
      notes: NOTES_POOL[i % NOTES_POOL.length],
      status: isInactive ? 'INACTIVE' : 'ACTIVE',
    };
  });
}

export const CUSTOMERS: CustomerSeed[] = generateCustomers();
