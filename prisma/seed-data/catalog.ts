// Trích xuất từ sep490-web-frontend/src/mocks/db/catalog.ts (CATEGORY_NAMES, SEED_PRODUCTS,
// KNOWN_EQUIPMENT_DETAILS, generateDefaultDetails/EQUIPMENT_ZONE_BY_CATEGORY logic) — 11 category, 11
// type (1 type/category, đúng quy ước "mỗi nhóm sản phẩm ứng với đúng 1 loại thiết bị" của frontend),
// 71 item. rentalPrice = price (mock); purchasePrice không có field tương ứng trực tiếp trong mock,
// dùng lại đúng công thức/giá trị `replacementValue` của frontend (dữ liệu thật cho 16 item, còn lại
// suy ra bằng generateDefaultDetails() — "giá trị thay thế nếu mất" khớp đúng ý nghĩa purchase_price
// trong docs/TABLES.md: "dùng tính bồi thường hỏng/mất").

export interface CategorySeed {
  categoryId: string;
  categoryName: string;
}

export interface TypeSeed {
  typeId: string;
  categoryId: string;
  typeName: string;
}

export interface ItemSeed {
  itemId: string;
  itemCode: string;
  itemName: string;
  typeId: string;
  unit: string;
  rentalPrice: number;
  purchasePrice: number;
  status: 'ACTIVE' | 'INACTIVE';
}

const CATEGORY_NAMES = [
  'Bàn ghế',
  'Khăn bàn & Áo ghế',
  'Ấm chén & Cốc',
  'Quạt',
  'Khung nhà rạp',
  'Mẩu sắt nối',
  'Bạt trắng & Rèm',
  'Đèn & Thảm',
  'Cổng hoa & Hoa giả',
  'Phụ kiện gallery',
  'Phông ăn cưới hỏi',
];

export const CATEGORIES: CategorySeed[] = CATEGORY_NAMES.map((name, index) => ({
  categoryId: `cat-${index + 1}`,
  categoryName: name,
}));

export const TYPES: TypeSeed[] = CATEGORIES.map((category) => ({
  typeId: `type-${category.categoryId}`,
  categoryId: category.categoryId,
  typeName: category.categoryName,
}));

function typeIdOfCategory(categoryName: string): string {
  const category = CATEGORIES.find((c) => c.categoryName === categoryName);
  return category ? `type-${category.categoryId}` : '';
}

interface SeedProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
}

const SEED_PRODUCTS: SeedProduct[] = [
  // Bàn ghế
  { id: 'BG001', name: 'Bàn loại to (Hộp chữ nhật 1.8m x 0.9m)', category: 'Bàn ghế', unit: 'Cái', price: 150000 },
  { id: 'BG002', name: 'Bàn loại nhỏ (Hộp chữ nhật 1.2m x 0.6m)', category: 'Bàn ghế', unit: 'Cái', price: 100000 },
  { id: 'BG003', name: 'Ghế đẩu', category: 'Bàn ghế', unit: 'Cái', price: 15000 },
  { id: 'BG004', name: 'Ghế inox', category: 'Bàn ghế', unit: 'Cái', price: 20000 },
  { id: 'BG005', name: 'Ghế chiavari', category: 'Bàn ghế', unit: 'Cái', price: 120000 },
  // Khăn bàn & Áo ghế
  { id: 'KB001', name: 'Khăn bàn màu đỏ', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000 },
  { id: 'KB002', name: 'Khăn bàn màu vàng', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000 },
  { id: 'KB003', name: 'Khăn bàn màu trắng', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000 },
  { id: 'KB004', name: 'Khăn bàn màu xanh dương', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000 },
  { id: 'KB005', name: 'Khăn bàn màu rêu', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000 },
  { id: 'KB006', name: 'Runner (dải vải trải dọc giữa bàn)', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 30000 },
  { id: 'KB007', name: 'Áo ghế', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 15000 },
  { id: 'KB008', name: 'Nơ ghế', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 10000 },
  // Ấm chén & Cốc
  { id: 'AC001', name: 'Cốc, chén, ấm nước', category: 'Ấm chén & Cốc', unit: 'Bộ', price: 250000 },
  // Quạt
  { id: 'QT001', name: 'Quạt công nghiệp', category: 'Quạt', unit: 'Cái', price: 200000 },
  { id: 'QT002', name: 'Quạt hơi nước', category: 'Quạt', unit: 'Cái', price: 400000 },
  // Khung nhà rạp
  { id: 'KR001', name: 'Thanh sắt 2.5m (Cột đứng rạp)', category: 'Khung nhà rạp', unit: 'Cái', price: 50000 },
  { id: 'KR002', name: 'Thanh sắt 3m (Thanh xà giằng)', category: 'Khung nhà rạp', unit: 'Cái', price: 60000 },
  { id: 'KR003', name: 'Thanh sắt 4m (Thanh xà dọc chính)', category: 'Khung nhà rạp', unit: 'Cái', price: 80000 },
  { id: 'KR004', name: 'Cột chống nhà rạp', category: 'Khung nhà rạp', unit: 'Cái', price: 100000 },
  { id: 'KR005', name: 'Kèo (Kèo lắp mái tam giác)', category: 'Khung nhà rạp', unit: 'Cái', price: 120000 },
  { id: 'KR006', name: 'Thanh sắt lắp nóc', category: 'Khung nhà rạp', unit: 'Cái', price: 70000 },
  // Mẩu sắt nối
  { id: 'MS001', name: 'Mẩu nối góc', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000 },
  { id: 'MS002', name: 'Mẩu dấu +', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000 },
  { id: 'MS003', name: 'Mẩu nối 2 thanh sắt', category: 'Mẩu sắt nối', unit: 'Cái', price: 10000 },
  { id: 'MS004', name: 'Mẩu nối thanh xà trên', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000 },
  { id: 'MS005', name: 'Mẩu lắp nóc', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000 },
  { id: 'MS006', name: 'Mẩu lắp kèo', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000 },
  // Bạt trắng & Rèm
  { id: 'BT001', name: 'Bạt trắng (6x7)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 500000 },
  { id: 'BT002', name: 'Bạt trắng (6x9)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 600000 },
  { id: 'BT003', name: 'Bạt trắng (3x4)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 200000 },
  { id: 'BT004', name: 'Bạt trắng (4x5)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 300000 },
  { id: 'BT005', name: 'Bạt trắng (4x3)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 220000 },
  { id: 'BT006', name: 'Bạt trắng (4x4)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 250000 },
  { id: 'BT007', name: 'Bạt trắng (6x3)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 350000 },
  { id: 'BT008', name: 'Bạt trắng (6x4)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 400000 },
  { id: 'BT009', name: 'Bạt trắng (6x5)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 450000 },
  { id: 'BT010', name: 'Bạt trắng (8x3)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 500000 },
  { id: 'BT011', name: 'Bạt trắng (8x4)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 550000 },
  { id: 'BT012', name: 'Bạt trắng (8x5)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 600000 },
  { id: 'BT013', name: 'Rèm quây xung quanh các màu', category: 'Bạt trắng & Rèm', unit: 'Bộ', price: 300000 },
  { id: 'BT014', name: 'Rèm tạo sóng', category: 'Bạt trắng & Rèm', unit: 'Bộ', price: 350000 },
  { id: 'BT015', name: 'Quây trần nhà rạp', category: 'Bạt trắng & Rèm', unit: 'Bộ', price: 800000 },
  // Đèn & Thảm
  { id: 'DT001', name: 'Đèn nhấp nháy', category: 'Đèn & Thảm', unit: 'Dây', price: 50000 },
  { id: 'DT002', name: 'Đèn chùm trang trí', category: 'Đèn & Thảm', unit: 'Cái', price: 300000 },
  { id: 'DT003', name: 'Đèn chạy dọc 20m', category: 'Đèn & Thảm', unit: 'Dây', price: 150000 },
  { id: 'DT004', name: 'Đèn chim', category: 'Đèn & Thảm', unit: 'Cái', price: 100000 },
  { id: 'DT005', name: 'Thảm cỏ', category: 'Đèn & Thảm', unit: 'm²', price: 40000 },
  { id: 'DT006', name: 'Thảm đỏ', category: 'Đèn & Thảm', unit: 'm²', price: 50000 },
  // Cổng hoa & Hoa giả
  { id: 'CH001', name: 'Khung cổng hình tròn', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 300000 },
  { id: 'CH002', name: 'Khung cổng hình vuông', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 300000 },
  { id: 'CH003', name: 'Khung cổng hình lục giác', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 350000 },
  { id: 'CH004', name: 'Cổng vòm bằng sắt để gắn hoa', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 400000 },
  { id: 'CH005', name: 'Cổng vòm bằng nhựa để gắn hoa', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 300000 },
  { id: 'CH006', name: 'Hoa giả tone trắng', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 150000 },
  { id: 'CH007', name: 'Hoa giả tone hồng', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 150000 },
  { id: 'CH008', name: 'Hoa giả tone đỏ', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 150000 },
  { id: 'CH009', name: 'Hoa giả tone pastel', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 180000 },
  { id: 'CH010', name: 'Hoa giả tone sen đá', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 200000 },
  // Phụ kiện gallery
  { id: 'PK001', name: 'Khung ảnh trang trí', category: 'Phụ kiện gallery', unit: 'Cái', price: 15000 },
  { id: 'PK002', name: 'Hòm tiền mừng (hình ngôi nhà)', category: 'Phụ kiện gallery', unit: 'Cái', price: 150000 },
  { id: 'PK003', name: 'Hòm tiền mừng (hình hòm thư)', category: 'Phụ kiện gallery', unit: 'Cái', price: 150000 },
  { id: 'PK004', name: 'Hòm tiền mừng (hình hòm mica trong suốt)', category: 'Phụ kiện gallery', unit: 'Cái', price: 200000 },
  { id: 'PK005', name: 'Bình hoa thủy tinh đủ kích thước', category: 'Phụ kiện gallery', unit: 'Chiếc', price: 50000 },
  { id: 'PK006', name: 'Khay 3 tầng', category: 'Phụ kiện gallery', unit: 'Chiếc', price: 60000 },
  { id: 'PK007', name: 'Khay gỗ', category: 'Phụ kiện gallery', unit: 'Chiếc', price: 40000 },
  { id: 'PK008', name: 'Khay 2 tầng sứ để bánh kẹo', category: 'Phụ kiện gallery', unit: 'Chiếc', price: 50000 },
  // Phông ăn cưới hỏi
  { id: 'PC001', name: 'Chữ trên phông', category: 'Phông ăn cưới hỏi', unit: 'Bộ', price: 200000 },
  { id: 'PC002', name: 'Đèn sân khấu', category: 'Phông ăn cưới hỏi', unit: 'Cái', price: 300000 },
  { id: 'PC003', name: 'Tráp ăn cưới hỏi', category: 'Phông ăn cưới hỏi', unit: 'Bộ', price: 1500000 },
  { id: 'PC004', name: 'Phông quây', category: 'Phông ăn cưới hỏi', unit: 'Bộ', price: 800000 },
];

// 16/71 item có replacementValue THẬT do người dùng cung cấp (KNOWN_EQUIPMENT_DETAILS ở
// sep490-web-frontend/src/mocks/db/catalog.ts) — dùng lại làm purchasePrice.
const KNOWN_REPLACEMENT_VALUE: Record<string, number> = {
  BG001: 1_200_000,
  BG002: 800_000,
  BG003: 50_000,
  BG004: 120_000,
  BG005: 1_200_000,
  KB001: 250_000,
  KB007: 60_000,
  AC001: 600_000,
  QT001: 1_800_000,
  QT002: 4_500_000,
  KR001: 200_000,
  KR004: 500_000,
  BT001: 3_500_000,
  DT001: 150_000,
  DT006: 100_000,
  CH001: 1_500_000,
  CH006: 400_000,
};

// 52 item còn lại: đúng công thức generateDefaultDetails() của frontend — replacementValue =
// round(price * 6 / 10_000) * 10_000.
function defaultPurchasePrice(price: number): number {
  return Math.round((price * 6) / 10_000) * 10_000;
}

export const ITEMS: ItemSeed[] = SEED_PRODUCTS.map((product) => ({
  itemId: product.id,
  itemCode: product.id,
  itemName: product.name,
  typeId: typeIdOfCategory(product.category),
  unit: product.unit,
  rentalPrice: product.price,
  purchasePrice: KNOWN_REPLACEMENT_VALUE[product.id] ?? defaultPurchasePrice(product.price),
  status: 'ACTIVE',
}));
