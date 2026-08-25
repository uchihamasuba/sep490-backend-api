// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import type {
  UserRole,
  ActiveStatus,
  QuotationStatus,
  OrderStatus,
  PaymentStatus,
  ScheduleStatus,
  SurveyStatus,
  ChangeRequestType,
  ChangeRequestStatus,
  SupplierTransactionType,
  SupplierTransactionStatus,
  DepositStatus,
  CollectedEquipmentReportStatus,
  OrderItemSource,
  ReservationStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

// "Hôm nay" của kịch bản seed — mọi ngày tháng tương đối (sự kiện đã xong / sắp diễn ra) tính từ mốc này.
const TODAY = new Date();

// ============================================================================
// HELPERS
// ============================================================================

const genId = (): string => crypto.randomUUID();

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pad(n: number, size: number): string {
  return String(n).padStart(size, '0');
}

// Thứ tự KHÔNG quan trọng cho TRUNCATE (FK checks tắt tạm thời), nhưng phải liệt kê đủ toàn bộ bảng
// thật (đối chiếu @@map trong schema.prisma) để đảm bảo reset sạch 100%.
const ALL_TABLES = [
  'notifications',
  'collected_equipment_report_items',
  'collected_equipment_reports',
  'inventory_movements',
  'inventory_reservations',
  'inventory',
  'settlement_evidences',
  'settlements',
  'deposit_evidences',
  'deposits',
  'supplier_transaction_items',
  'supplier_transactions',
  'change_request_items',
  'change_requests',
  'survey_report_evidences',
  'survey_reports',
  'attendances',
  'schedule_plan_assignees',
  'schedule_plan_evidences',
  'schedule_plans',
  'work_tasks',
  'order_items',
  'orders',
  'quotation_items',
  'quotations',
  'evidences',
  'item_components',
  'items',
  'item_types',
  'item_categories',
  'business_policies',
  'supplier_items',
  'suppliers',
  'customers',
  'users',
];

async function resetDatabase(): Promise<void> {
  console.log('Resetting database (TRUNCATE all tables)...');
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  for (const table of ALL_TABLES) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('Database reset complete.');
}

// ============================================================================
// DATA TABLES — Master data mẫu (Tiếng Việt, thực tế cho ngành tổ chức sự kiện)
// ============================================================================

interface UserSeed {
  username: string;
  fullName: string;
  role: UserRole;
  jobTitle?: string;
  phone: string;
  email: string;
}

const USERS_SEED: UserSeed[] = [
  { username: 'admin', fullName: 'Nguyễn Văn An', role: 'ADMIN', phone: '0901111001', email: 'admin@bnwevents.vn' },
  { username: 'manager', fullName: 'Lê Hoàng Nam', role: 'MANAGER', jobTitle: 'Trưởng phòng Kinh doanh', phone: '0902222001', email: 'manager@bnwevents.vn' },
  { username: 'staff1', fullName: 'Vũ Đức Thắng', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0903333001', email: 'staff1@bnwevents.vn' },
  { username: 'staff2', fullName: 'Hoàng Văn Long', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0903333002', email: 'staff2@bnwevents.vn' },
  { username: 'staff3', fullName: 'Ngô Thị Lan', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0903333003', email: 'staff3@bnwevents.vn' },
  { username: 'staff4', fullName: 'Bùi Quang Huy', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0903333004', email: 'staff4@bnwevents.vn' },
  { username: 'staff5', fullName: 'Đặng Văn Sơn', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444001', email: 'staff5@bnwevents.vn' },
  { username: 'staff6', fullName: 'Phan Thị Mai', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444002', email: 'staff6@bnwevents.vn' },
  { username: 'staff7', fullName: 'Trịnh Văn Hùng', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444003', email: 'staff7@bnwevents.vn' },
  { username: 'staff8', fullName: 'Lý Thị Thu', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444004', email: 'staff8@bnwevents.vn' },
  { username: 'staff9', fullName: 'Đinh Văn Phúc', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444005', email: 'staff9@bnwevents.vn' },
  { username: 'staff10', fullName: 'Dương Thị Nga', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444006', email: 'staff10@bnwevents.vn' },
];

interface PolicySeed {
  code: string;
  name: string;
  type: 'DEPOSIT' | 'CANCELLATION' | 'COMPENSATION' | 'FEE' | 'WAGE';
  value: number;
  unit: string;
  description: string;
}

const POLICIES_SEED: PolicySeed[] = [
  { code: 'DEP-30', name: 'Đặt cọc 30% giá trị đơn hàng', type: 'DEPOSIT', value: 30, unit: 'PERCENT', description: 'Áp dụng cho hầu hết đơn hàng khi khách xác nhận booking.' },
  { code: 'CAN-15', name: 'Phí huỷ đơn trước sự kiện 7 ngày', type: 'CANCELLATION', value: 15, unit: 'PERCENT', description: 'Tính trên tổng giá trị đơn hàng nếu khách huỷ trong vòng 7 ngày trước sự kiện.' },
  { code: 'COM-100', name: 'Đền bù thiết bị hư hỏng / mất mát', type: 'COMPENSATION', value: 100, unit: 'PERCENT', description: 'Đền bù 100% giá trị mua mới cho thiết bị hư hỏng hoặc thất lạc sau sự kiện.' },
  { code: 'FEE-OT', name: 'Phí phát sinh ngoài giờ vận hành', type: 'FEE', value: 200000, unit: 'VND/gio', description: 'Áp dụng khi sự kiện kéo dài quá thời gian trong hợp đồng.' },
  { code: 'WAGE-DAY', name: 'Công tác phí kỹ thuật viên/ngày công', type: 'WAGE', value: 300000, unit: 'VND/ngay', description: 'Phụ cấp công tác xa cho kỹ thuật viên/leader khi sự kiện ở tỉnh khác.' },
];

interface CategorySeed {
  code: string;
  name: string;
}

const CATEGORIES_SEED: CategorySeed[] = [
  { code: 'CAT-FURNITURE', name: 'Bàn ghế & Phụ kiện' },
  { code: 'CAT-TENT', name: 'Khung nhà rạp & Bạt che' },
  { code: 'CAT-DECOR', name: 'Trang trí & Phông bạt' },
  { code: 'CAT-COOLING', name: 'Thiết bị làm mát' },
  { code: 'CAT-AV', name: 'Âm thanh & Ánh sáng' },
];

interface TypeSeed {
  code: string;
  name: string;
  categoryCode: string;
}

const TYPES_SEED: TypeSeed[] = [
  // Bàn ghế & Phụ kiện
  { code: 'TYPE-TABLE', name: 'Bàn', categoryCode: 'CAT-FURNITURE' },
  { code: 'TYPE-CHAIR', name: 'Ghế', categoryCode: 'CAT-FURNITURE' },
  { code: 'TYPE-LINEN', name: 'Khăn & Phụ kiện ghế', categoryCode: 'CAT-FURNITURE' },
  { code: 'TYPE-UTENSIL', name: 'Dụng cụ ăn uống', categoryCode: 'CAT-FURNITURE' },
  // Khung nhà rạp & Bạt che
  { code: 'TYPE-FRAME', name: 'Khung sắt', categoryCode: 'CAT-TENT' },
  { code: 'TYPE-JOINT', name: 'Khớp nối', categoryCode: 'CAT-TENT' },
  { code: 'TYPE-TARPAULIN', name: 'Bạt che', categoryCode: 'CAT-TENT' },
  // Trang trí & Phông bạt
  { code: 'TYPE-CURTAIN', name: 'Rạp & Trần', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-ARCH', name: 'Cổng hoa', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-FLOWER', name: 'Hoa lụa', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-GALLERY', name: 'Phụ kiện Gallery', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-BACKDROP', name: 'Phông cưới hỏi', categoryCode: 'CAT-DECOR' },
  // Thiết bị làm mát
  { code: 'TYPE-FAN', name: 'Quạt', categoryCode: 'CAT-COOLING' },
  // Âm thanh & Ánh sáng
  { code: 'TYPE-LIGHT', name: 'Đèn trang trí & Sân khấu', categoryCode: 'CAT-AV' },
  { code: 'TYPE-AUDIO', name: 'Âm thanh', categoryCode: 'CAT-AV' },
];

interface ItemSeed {
  code: string;
  name: string;
  typeCode: string;
  unit: string;
  rentalPrice: number;
  purchasePrice: number;
  /** Vật tư số lượng lớn (bàn/ghế/khăn/thảm...) — quantity đặt hàng thường lớn hơn nhiều so với thiết bị kỹ thuật. */
  bulk?: boolean;
}

const ITEMS_SEED: ItemSeed[] = [
  // Bàn
  { code: 'ITEM-TBL-L', name: 'Bàn tiệc tròn loại to (1m5)', typeCode: 'TYPE-TABLE', unit: 'Cái', rentalPrice: 100000, purchasePrice: 1800000, bulk: true },
  { code: 'ITEM-TBL-S', name: 'Bàn tiệc tròn loại nhỏ (1m2)', typeCode: 'TYPE-TABLE', unit: 'Cái', rentalPrice: 80000, purchasePrice: 1500000, bulk: true },
  // Ghế
  { code: 'ITEM-CHR-STL', name: 'Ghế đẩu', typeCode: 'TYPE-CHAIR', unit: 'Cái', rentalPrice: 10000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-CHR-INOX', name: 'Ghế inox', typeCode: 'TYPE-CHAIR', unit: 'Cái', rentalPrice: 15000, purchasePrice: 150000, bulk: true },
  { code: 'ITEM-CHR-CHIA', name: 'Ghế chiavari', typeCode: 'TYPE-CHAIR', unit: 'Cái', rentalPrice: 35000, purchasePrice: 450000, bulk: true },
  // Khăn & Phụ kiện ghế
  { code: 'ITEM-LIN-RED', name: 'Khăn bàn đỏ', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-YEL', name: 'Khăn bàn vàng', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-WHI', name: 'Khăn bàn trắng', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-BLU', name: 'Khăn bàn xanh dương', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-GRN', name: 'Khăn bàn rêu', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-RUN', name: 'Runner (dải vải trải dọc giữa bàn)', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 15000, purchasePrice: 80000, bulk: true },
  { code: 'ITEM-LIN-CHR', name: 'Áo ghế', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 10000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-LIN-BOW', name: 'Nơ ghế', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 5000, purchasePrice: 20000, bulk: true },
  // Dụng cụ ăn uống
  { code: 'ITEM-UTE-CUP', name: 'Cốc thủy tinh', typeCode: 'TYPE-UTENSIL', unit: 'Cái', rentalPrice: 2000, purchasePrice: 15000, bulk: true },
  { code: 'ITEM-UTE-BOWL', name: 'Chén sứ', typeCode: 'TYPE-UTENSIL', unit: 'Cái', rentalPrice: 2000, purchasePrice: 15000, bulk: true },
  { code: 'ITEM-UTE-POT', name: 'Ấm nước', typeCode: 'TYPE-UTENSIL', unit: 'Cái', rentalPrice: 10000, purchasePrice: 80000, bulk: true },
  // Khung sắt
  { code: 'ITEM-FRM-25', name: 'Thanh sắt 2.5m', typeCode: 'TYPE-FRAME', unit: 'Thanh', rentalPrice: 20000, purchasePrice: 150000, bulk: true },
  { code: 'ITEM-FRM-3M', name: 'Thanh sắt 3m', typeCode: 'TYPE-FRAME', unit: 'Thanh', rentalPrice: 25000, purchasePrice: 180000, bulk: true },
  { code: 'ITEM-FRM-4M', name: 'Thanh sắt 4m', typeCode: 'TYPE-FRAME', unit: 'Thanh', rentalPrice: 30000, purchasePrice: 220000, bulk: true },
  { code: 'ITEM-FRM-COL', name: 'Cột chống', typeCode: 'TYPE-FRAME', unit: 'Cột', rentalPrice: 35000, purchasePrice: 250000, bulk: true },
  { code: 'ITEM-FRM-RAF', name: 'Kèo', typeCode: 'TYPE-FRAME', unit: 'Cây', rentalPrice: 40000, purchasePrice: 300000, bulk: true },
  { code: 'ITEM-FRM-ROOF', name: 'Thanh sắt lắp nóc', typeCode: 'TYPE-FRAME', unit: 'Thanh', rentalPrice: 25000, purchasePrice: 180000, bulk: true },
  // Khớp nối
  { code: 'ITEM-JNT-ANG', name: 'Mẩu nối góc', typeCode: 'TYPE-JOINT', unit: 'Cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-CRS', name: 'Mẩu dấu +', typeCode: 'TYPE-JOINT', unit: 'Cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-STR', name: 'Mẩu nối 2 thanh sắt', typeCode: 'TYPE-JOINT', unit: 'Cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-TOP', name: 'Mẩu nối thanh xà trên', typeCode: 'TYPE-JOINT', unit: 'Cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-ROOF', name: 'Mẩu lắp nóc', typeCode: 'TYPE-JOINT', unit: 'Cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-RAF', name: 'Mẩu lắp kèo', typeCode: 'TYPE-JOINT', unit: 'Cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  // Bạt che
  { code: 'ITEM-TARP-6X7', name: 'Bạt trắng 6x7', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 150000, purchasePrice: 800000, bulk: true },
  { code: 'ITEM-TARP-6X9', name: 'Bạt trắng 6x9', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 200000, purchasePrice: 1000000, bulk: true },
  { code: 'ITEM-TARP-3X4', name: 'Bạt trắng 3x4', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 50000, purchasePrice: 300000, bulk: true },
  { code: 'ITEM-TARP-4X5', name: 'Bạt trắng 4x5', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 80000, purchasePrice: 400000, bulk: true },
  { code: 'ITEM-TARP-4X3', name: 'Bạt trắng 4x3', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 50000, purchasePrice: 300000, bulk: true },
  { code: 'ITEM-TARP-4X4', name: 'Bạt trắng 4x4', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 70000, purchasePrice: 350000, bulk: true },
  { code: 'ITEM-TARP-6X3', name: 'Bạt trắng 6x3', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 80000, purchasePrice: 400000, bulk: true },
  { code: 'ITEM-TARP-6X4', name: 'Bạt trắng 6x4', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 100000, purchasePrice: 500000, bulk: true },
  { code: 'ITEM-TARP-6X5', name: 'Bạt trắng 6x5', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 120000, purchasePrice: 600000, bulk: true },
  { code: 'ITEM-TARP-8X3', name: 'Bạt trắng 8x3', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 100000, purchasePrice: 500000, bulk: true },
  { code: 'ITEM-TARP-8X4', name: 'Bạt trắng 8x4', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 130000, purchasePrice: 700000, bulk: true },
  { code: 'ITEM-TARP-8X5', name: 'Bạt trắng 8x5', typeCode: 'TYPE-TARPAULIN', unit: 'Tấm', rentalPrice: 160000, purchasePrice: 850000, bulk: true },
  // Rạp & Trần
  { code: 'ITEM-CUR-SUR', name: 'Rèm quây xung quanh (các màu)', typeCode: 'TYPE-CURTAIN', unit: 'M2', rentalPrice: 10000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-CUR-WAV', name: 'Rèm tạo sóng', typeCode: 'TYPE-CURTAIN', unit: 'M2', rentalPrice: 15000, purchasePrice: 70000, bulk: true },
  { code: 'ITEM-CUR-ROOF', name: 'Quây trần nhà', typeCode: 'TYPE-CURTAIN', unit: 'M2', rentalPrice: 15000, purchasePrice: 70000, bulk: true },
  { code: 'ITEM-CAR-GRASS', name: 'Thảm cỏ', typeCode: 'TYPE-CURTAIN', unit: 'M2', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-CAR-RED', name: 'Thảm đỏ', typeCode: 'TYPE-CURTAIN', unit: 'M2', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  // Cổng hoa
  { code: 'ITEM-ARC-CIR', name: 'Cổng hoa khung tròn', typeCode: 'TYPE-ARCH', unit: 'Cái', rentalPrice: 800000, purchasePrice: 3500000, bulk: true },
  { code: 'ITEM-ARC-SQU', name: 'Cổng hoa khung vuông', typeCode: 'TYPE-ARCH', unit: 'Cái', rentalPrice: 800000, purchasePrice: 3500000, bulk: true },
  { code: 'ITEM-ARC-HEX', name: 'Cổng hoa hình lục giác', typeCode: 'TYPE-ARCH', unit: 'Cái', rentalPrice: 900000, purchasePrice: 4000000, bulk: true },
  { code: 'ITEM-ARC-DOM', name: 'Cổng vòm sắt/nhựa', typeCode: 'TYPE-ARCH', unit: 'Cái', rentalPrice: 700000, purchasePrice: 3000000, bulk: true },
  // Hoa lụa
  { code: 'ITEM-FLW-WHI', name: 'Hoa giả tone trắng', typeCode: 'TYPE-FLOWER', unit: 'Cụm', rentalPrice: 50000, purchasePrice: 200000, bulk: true },
  { code: 'ITEM-FLW-PNK', name: 'Hoa giả tone hồng', typeCode: 'TYPE-FLOWER', unit: 'Cụm', rentalPrice: 50000, purchasePrice: 200000, bulk: true },
  { code: 'ITEM-FLW-RED', name: 'Hoa giả tone đỏ', typeCode: 'TYPE-FLOWER', unit: 'Cụm', rentalPrice: 50000, purchasePrice: 200000, bulk: true },
  { code: 'ITEM-FLW-PAS', name: 'Hoa giả tone pastel', typeCode: 'TYPE-FLOWER', unit: 'Cụm', rentalPrice: 50000, purchasePrice: 200000, bulk: true },
  { code: 'ITEM-FLW-SUC', name: 'Hoa giả tone sen đá', typeCode: 'TYPE-FLOWER', unit: 'Cụm', rentalPrice: 60000, purchasePrice: 250000, bulk: true },
  // Phụ kiện Gallery
  { code: 'ITEM-GAL-FRM', name: 'Khung ảnh trang trí', typeCode: 'TYPE-GALLERY', unit: 'Cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-GAL-HOU', name: 'Hòm tiền mừng (Hình ngôi nhà)', typeCode: 'TYPE-GALLERY', unit: 'Cái', rentalPrice: 150000, purchasePrice: 600000, bulk: true },
  { code: 'ITEM-GAL-BOX', name: 'Hòm tiền mừng (Hòm thư)', typeCode: 'TYPE-GALLERY', unit: 'Cái', rentalPrice: 150000, purchasePrice: 600000, bulk: true },
  { code: 'ITEM-GAL-MIC', name: 'Hòm tiền mừng (Mica trong suốt)', typeCode: 'TYPE-GALLERY', unit: 'Cái', rentalPrice: 200000, purchasePrice: 800000, bulk: true },
  { code: 'ITEM-GAL-VAS', name: 'Bình hoa thủy tinh', typeCode: 'TYPE-GALLERY', unit: 'Cái', rentalPrice: 30000, purchasePrice: 150000, bulk: true },
  { code: 'ITEM-GAL-TR3', name: 'Khay 3 tầng', typeCode: 'TYPE-GALLERY', unit: 'Cái', rentalPrice: 50000, purchasePrice: 250000, bulk: true },
  { code: 'ITEM-GAL-TRW', name: 'Khay gỗ', typeCode: 'TYPE-GALLERY', unit: 'Cái', rentalPrice: 30000, purchasePrice: 150000, bulk: true },
  { code: 'ITEM-GAL-TR2', name: 'Khay 2 tầng sứ', typeCode: 'TYPE-GALLERY', unit: 'Cái', rentalPrice: 60000, purchasePrice: 300000, bulk: true },
  // Phông cưới hỏi
  { code: 'ITEM-BKG-TXT', name: 'Chữ trên phông', typeCode: 'TYPE-BACKDROP', unit: 'Bộ', rentalPrice: 150000, purchasePrice: 500000, bulk: true },
  { code: 'ITEM-BKG-LGT', name: 'Đèn sân khấu (Phông)', typeCode: 'TYPE-BACKDROP', unit: 'Cái', rentalPrice: 100000, purchasePrice: 400000, bulk: true },
  { code: 'ITEM-BKG-TRP', name: 'Tráp ăn hỏi', typeCode: 'TYPE-BACKDROP', unit: 'Cái', rentalPrice: 100000, purchasePrice: 500000, bulk: true },
  { code: 'ITEM-BKG-CUR', name: 'Phông quây', typeCode: 'TYPE-BACKDROP', unit: 'M2', rentalPrice: 15000, purchasePrice: 70000, bulk: true },
  // Quạt
  { code: 'ITEM-FAN-IND', name: 'Quạt công nghiệp', typeCode: 'TYPE-FAN', unit: 'Cái', rentalPrice: 100000, purchasePrice: 800000, bulk: true },
  { code: 'ITEM-FAN-WAT', name: 'Quạt hơi nước', typeCode: 'TYPE-FAN', unit: 'Cái', rentalPrice: 250000, purchasePrice: 3500000, bulk: true },
  // Đèn
  { code: 'ITEM-LGT-BLK', name: 'Đèn nhấp nháy', typeCode: 'TYPE-LIGHT', unit: 'Dây', rentalPrice: 20000, purchasePrice: 80000, bulk: true },
  { code: 'ITEM-LGT-CHA', name: 'Đèn chùm', typeCode: 'TYPE-LIGHT', unit: 'Cái', rentalPrice: 200000, purchasePrice: 1500000, bulk: true },
  { code: 'ITEM-LGT-20M', name: 'Đèn chạy dọc 20m', typeCode: 'TYPE-LIGHT', unit: 'Dây', rentalPrice: 100000, purchasePrice: 500000, bulk: true },
  { code: 'ITEM-LGT-BRD', name: 'Đèn chim', typeCode: 'TYPE-LIGHT', unit: 'Cái', rentalPrice: 50000, purchasePrice: 200000, bulk: true },
  { code: 'ITEM-LGT-STG', name: 'Đèn Par LED sân khấu', typeCode: 'TYPE-LIGHT', unit: 'Cái', rentalPrice: 120000, purchasePrice: 2500000, bulk: true },
  // Âm thanh
  { code: 'ITEM-AUD-SYS', name: 'Hệ thống loa đài cơ bản', typeCode: 'TYPE-AUDIO', unit: 'Bộ', rentalPrice: 1500000, purchasePrice: 25000000, bulk: true },

  // Các Gói Combo (Packages)
  { code: 'PKG-TENT-6X9', name: 'Gói Nhà Rạp 6x9m Cơ Bản', typeCode: 'TYPE-TARPAULIN', unit: 'Gói', rentalPrice: 2000000, purchasePrice: 0, bulk: true },
  { code: 'PKG-GALLERY', name: 'Gói Trang trí Bàn Gallery', typeCode: 'TYPE-GALLERY', unit: 'Gói', rentalPrice: 1500000, purchasePrice: 0, bulk: true },
];

interface ComponentSeed {
  parentCode: string;
  childCode: string;
  quantity: number;
}

// Cấu trúc BOM cho các item dạng "Gói trọn gói" — parent là item combo, child là thiết bị lẻ cấu thành.
const ITEM_COMPONENTS_SEED: ComponentSeed[] = [
  { parentCode: 'PKG-TENT-6X9', childCode: 'ITEM-FRM-3M', quantity: 12 },
  { parentCode: 'PKG-TENT-6X9', childCode: 'ITEM-FRM-COL', quantity: 6 },
  { parentCode: 'PKG-TENT-6X9', childCode: 'ITEM-TARP-6X9', quantity: 1 },
  { parentCode: 'PKG-TENT-6X9', childCode: 'ITEM-CUR-ROOF', quantity: 54 },
  { parentCode: 'PKG-TENT-6X9', childCode: 'ITEM-FAN-IND', quantity: 4 },
  { parentCode: 'PKG-TENT-6X9', childCode: 'ITEM-LGT-BLK', quantity: 10 },
  
  { parentCode: 'PKG-GALLERY', childCode: 'ITEM-LIN-WHI', quantity: 2 },
  { parentCode: 'PKG-GALLERY', childCode: 'ITEM-GAL-HOU', quantity: 1 },
  { parentCode: 'PKG-GALLERY', childCode: 'ITEM-GAL-TR3', quantity: 1 },
  { parentCode: 'PKG-GALLERY', childCode: 'ITEM-GAL-VAS', quantity: 2 },
  { parentCode: 'PKG-GALLERY', childCode: 'ITEM-GAL-FRM', quantity: 4 },
];

interface PartySeed {
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  status?: ActiveStatus;
}

interface SupplierSeed extends PartySeed {
  serviceType: string;
  contactPerson: string;
  rating: number;
}

const SUPPLIERS_SEED: SupplierSeed[] = [
  { code: 'SUP-001', name: 'Xưởng Cơ Khí & Bạt Sự Kiện Hùng Phát', serviceType: 'Khung nhà rạp, khớp nối, bạt che', contactPerson: 'Nguyễn Văn Hải', phone: '0933333001', email: 'hungphat@gmail.com', address: '12 Quang Trung, Hà Nội', rating: 4.5 },
  { code: 'SUP-002', name: 'Kho Bàn Ghế & Phụ Kiện Thành Công', serviceType: 'Bàn ghế tiệc, khăn, áo ghế, dụng cụ ăn uống', contactPerson: 'Trần Văn Đạt', phone: '0933333002', email: 'thanhcong@gmail.com', address: '34 Lê Văn Việt, TP.HCM', rating: 4.2 },
  { code: 'SUP-003', name: 'Vựa Hoa & Trang Trí Lan Anh', serviceType: 'Cổng hoa, hoa lụa, phụ kiện gallery, phông cưới', contactPerson: 'Nguyễn Thị Lan Anh', phone: '0933333004', email: 'lananhflower@gmail.com', address: '78 Hoàng Hoa Thám, Hà Nội', rating: 4.9 },
  { code: 'SUP-004', name: 'Xưởng Điện Nước Toàn Phát', serviceType: 'Quạt công nghiệp, quạt hơi nước', contactPerson: 'Lê Thị Hạnh', phone: '0933333003', email: 'toanphat@gmail.com', address: '56 Phạm Văn Đồng, TP.HCM', rating: 4.7 },
  { code: 'SUP-005', name: 'Âm Thanh Ánh Sáng Nam Việt', serviceType: 'Đèn trang trí, hệ thống loa đài', contactPerson: 'Phạm Văn Sơn', phone: '0933333005', email: 'namviet@gmail.com', address: '90 Nguyễn Xí, TP.HCM', rating: 4.6 },
  { code: 'SUP-006', name: 'Đơn Vị In Ấn Thiệp & Phông', serviceType: 'Chữ trên phông, in ấn', contactPerson: 'Đặng Thị Thu', phone: '0933333006', email: 'inanthiep@gmail.com', address: '23 Trần Não, Q.2, TP.HCM', rating: 4.6 },
  { code: 'SUP-007', name: 'Công ty CP Vận Tải Sự Kiện Nhanh', serviceType: 'Vận chuyển thiết bị sự kiện', contactPerson: 'Bùi Văn Khoa', phone: '0933333007', email: 'nhanhtransport@gmail.com', address: '45 Giải Phóng, Hoàng Mai, Hà Nội', rating: 4.0 },
];

const WORK_TASKS_SEED = [
  { code: 'SURVEY', name: 'Khảo sát hiện trường' },
  { code: 'SETUP', name: 'Lắp đặt thiết bị' },
  { code: 'COLLECT', name: 'Thu hồi thiết bị' },
];

const EVENT_TYPES = [
  'Hội nghị doanh nghiệp',
  'Tiệc cưới',
  'Lễ khai trương',
  'Tiệc sinh nhật',
  'Lễ kỷ niệm thành lập',
  'Team building',
  'Lễ ra mắt sản phẩm',
  'Hội thảo chuyên đề',
  'Gala Dinner',
  'Lễ tốt nghiệp',
  'Đám cưới (Nhà trai)',
  'Đám cưới (Nhà gái)',
  'Lễ ăn hỏi (Nhà trai)',
  'Lễ ăn hỏi (Nhà gái)',
];

const COMPLEX_EVENT_TYPES = new Set(['Hội nghị doanh nghiệp', 'Hội thảo chuyên đề', 'Gala Dinner', 'Lễ ra mắt sản phẩm', 'Đám cưới (Nhà trai)', 'Đám cưới (Nhà gái)']);

const VENUES = [
  { name: 'Trung tâm Hội nghị Quốc gia, Hà Nội', lat: 21.0069, lng: 105.7869 },
  { name: 'Gem Center, Q.1, TP.HCM', lat: 10.7877, lng: 106.6998 },
  { name: 'White Palace, Phú Nhuận, TP.HCM', lat: 10.8016, lng: 106.6782 },
  { name: 'Ana Mandara Resort, Nha Trang', lat: 12.2359, lng: 109.1963 },
  { name: 'Khách sạn Rex Sài Gòn, Q.1, TP.HCM', lat: 10.7761, lng: 106.7018 },
  { name: 'Furama Resort, Đà Nẵng', lat: 16.0371, lng: 108.2483 },
  { name: 'Trung tâm Tiệc cưới Adora, Tân Bình, TP.HCM', lat: 10.7966, lng: 106.6620 },
  { name: 'Sân vận động Mỹ Đình, Hà Nội', lat: 21.0187, lng: 105.7635 },
  { name: 'Khuôn viên Trường Đại học HUTECH, Bình Thạnh, TP.HCM', lat: 10.8018, lng: 106.7146 },
  { name: 'Nhà hàng Tiệc cưới Riverside Palace, Q.7, TP.HCM', lat: 10.7523, lng: 106.6963 },
];

const EVIDENCE_DESCRIPTIONS = [
  'Ảnh chụp hiện trường trước khi lắp đặt',
  'Ảnh nghiệm thu sau khi lắp đặt hoàn tất',
  'Ảnh biên bản bàn giao thiết bị',
  'Ảnh chụp màn hình chuyển khoản đặt cọc',
  'Ảnh chụp màn hình chuyển khoản quyết toán',
  'Video khảo sát tổng quan mặt bằng',
  'Ảnh thiết bị lúc thu hồi sau sự kiện',
  'Ảnh nhân sự check-in tại hiện trường',
];

// ============================================================================
// MAIN SEED FLOW
// ============================================================================

interface CreatedUser {
  userId: string;
  username: string;
  role: UserRole;
}

interface CreatedItem {
  itemId: string;
  code: string;
  name: string;
  rentalPrice: number;
  purchasePrice: number;
  bulk: boolean;
}

interface CreatedParty {
  id: string;
  code: string;
  name: string;
}

interface OrderItemPick {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface CreatedOrder {
  orderId: string;
  orderCode: string;
  customerId: string;
  status: OrderStatus;
  eventType: string;
  eventDate: Date;
  totalAmount: number;
  items: OrderItemPick[];
  leaderId: string;
  technicalIds: string[];
}

async function main(): Promise<void> {
  await resetDatabase();
  console.log('Seeding new data...');

  // ==========================================================================
  // 1. USERS
  // ==========================================================================
  const passwordHash = await bcrypt.hash('123456', BCRYPT_ROUNDS);
  let employeeSeq = 0;
  const usersData = USERS_SEED.map((u) => {
    const isOperational = u.role === 'STAFF';
    if (isOperational) employeeSeq += 1;
    return {
      userId: genId(),
      username: u.username,
      passwordHash,
      fullName: u.fullName,
      role: u.role,
      email: u.email,
      phone: u.phone,
      jobTitle: u.jobTitle,
      employeeCode: isOperational ? `NV${pad(employeeSeq, 3)}` : null,
      deviceToken: `dummy-device-token-${u.username}`,
    };
  });
  await prisma.user.createMany({ data: usersData });

  const allUsers: CreatedUser[] = usersData.map((u) => ({ userId: u.userId, username: u.username, role: u.role }));
  const admins = allUsers.filter((u) => u.role === 'ADMIN');
  const managers = allUsers.filter((u) => u.role === 'MANAGER');
  const operationalPool = allUsers.filter((u) => u.role === 'STAFF');
  console.log(`  - ${allUsers.length} users (admin=${admins.length}, manager=${managers.length}, staff=${operationalPool.length})`);

  // ==========================================================================
  // 2. BUSINESS POLICIES
  // ==========================================================================
  await prisma.businessPolicy.createMany({
    data: POLICIES_SEED.map((p) => ({
      policyId: genId(),
      policyCode: p.code,
      policyName: p.name,
      policyType: p.type,
      description: p.description,
      policyValue: p.value,
      unit: p.unit,
    })),
  });
  const policies = await prisma.businessPolicy.findMany();
  const depositPolicy = policies.find((p: any) => p.policyCode === 'DEP-30')!;
  const compensationPolicy = policies.find((p: any) => p.policyCode === 'COM-100')!;
  const feePolicy = policies.find((p: any) => p.policyCode === 'FEE-OT')!;

  // ==========================================================================
  // 3. CATALOG — Category > Type > Item > ItemComponent (BOM)
  // ==========================================================================
  const categoryIdByCode = new Map<string, string>();
  await prisma.itemCategory.createMany({
    data: CATEGORIES_SEED.map((c) => {
      const id = genId();
      categoryIdByCode.set(c.code, id);
      return { categoryId: id, categoryCode: c.code, categoryName: c.name };
    }),
  });

  const typeIdByCode = new Map<string, string>();
  await prisma.itemType.createMany({
    data: TYPES_SEED.map((t) => {
      const id = genId();
      typeIdByCode.set(t.code, id);
      return { typeId: id, categoryId: categoryIdByCode.get(t.categoryCode)!, typeCode: t.code, typeName: t.name };
    }),
  });

  const itemIdByCode = new Map<string, string>();
  await prisma.item.createMany({
    data: ITEMS_SEED.map((it) => {
      const id = genId();
      itemIdByCode.set(it.code, id);
      return {
        itemId: id,
        itemCode: it.code,
        itemName: it.name,
        typeId: typeIdByCode.get(it.typeCode)!,
        unit: it.unit,
        rentalPrice: it.rentalPrice,
        purchasePrice: it.purchasePrice,
      };
    }),
  });

  await prisma.itemComponent.createMany({
    data: ITEM_COMPONENTS_SEED.map((c) => ({
      id: genId(),
      parentId: itemIdByCode.get(c.parentCode)!,
      childId: itemIdByCode.get(c.childCode)!,
      quantity: c.quantity,
    })),
  });

  const items: CreatedItem[] = ITEMS_SEED.map((it) => ({
    itemId: itemIdByCode.get(it.code)!,
    code: it.code,
    name: it.name,
    rentalPrice: it.rentalPrice,
    purchasePrice: it.purchasePrice,
    bulk: Boolean(it.bulk),
  }));
  console.log(`  - ${CATEGORIES_SEED.length} categories, ${TYPES_SEED.length} types, ${items.length} items, ${ITEM_COMPONENTS_SEED.length} BOM components`);

  // ==========================================================================
  // 4. CUSTOMERS & SUPPLIERS
  // ==========================================================================
  await prisma.supplier.createMany({
    data: SUPPLIERS_SEED.map((s) => ({
      supplierId: genId(),
      supplierCode: s.code,
      supplierName: s.name,
      serviceType: s.serviceType,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      address: s.address,
      rating: s.rating,
    })),
  });
  const supplierRows = await prisma.supplier.findMany();
  const suppliers: CreatedParty[] = supplierRows.map((s: any) => ({ id: s.supplierId, code: s.supplierCode, name: s.supplierName }));

  const supplierItemsData: { supplierId: string; itemId: string; rentalPrice: number; purchasePrice: number; isActive: boolean; minQuantity: number | null; supplierItemCode: string | null }[] = [];
  for (const supplier of suppliers) {
    // Pick 3-8 random items for each supplier to simulate many-to-many relationship
    const numItems = randomInt(3, 8);
    const assignedItems = sample(items, numItems);
    for (const item of assignedItems) {
      // Mock some logical values for the new fields
      const rentalPrice = round2(item.rentalPrice * 0.8);
      const purchasePrice = round2(item.purchasePrice * 0.8);
      const isActive = Math.random() > 0.1; // 90% active
      const minQuantity = item.bulk ? randomInt(10, 50) : (Math.random() > 0.5 ? randomInt(1, 5) : null);
      const supplierItemCode = `SIC-${supplier.code}-${item.code}`;

      supplierItemsData.push({
        supplierId: supplier.id,
        itemId: item.itemId,
        rentalPrice,
        purchasePrice,
        isActive,
        minQuantity,
        supplierItemCode,
      });
    }
  }
  await prisma.supplierItem.createMany({
    data: supplierItemsData,
    skipDuplicates: true, // Just in case
  });

  console.log(`  - ${suppliers.length} suppliers, ${supplierItemsData.length} supplier items`);

  // ==========================================================================
  // 8. WORK TASKS
  // ==========================================================================
  const taskIdByCode = new Map<string, string>();
  await prisma.workTask.createMany({
    data: WORK_TASKS_SEED.map((t) => {
      const id = genId();
      taskIdByCode.set(t.code, id);
      return { taskId: id, taskCode: t.code, taskName: t.name };
    }),
  });
  // 9. INVENTORY — 1 dòng cho TOÀN BỘ items (available + reserved + damaged = total)
  // ==========================================================================
  await prisma.inventory.createMany({
    data: items.map((it) => {
      const quantityTotal = it.bulk ? randomInt(50, 200) : randomInt(10, 30);
      return {
        inventoryId: genId(),
        itemId: it.itemId,
        quantityTotal,
        quantityDamaged: 0,
      };
    }),
  });

  // ==========================================================================
  // 10. INVENTORY MOVEMENTS — OUTBOUND/INBOUND thu thập ở bước 8, cộng thêm vài ADJUSTMENT
  // ==========================================================================
  const inventoryMovements: any[] = [];
  for (const extra of sample(items, 6)) {
    inventoryMovements.push({
      itemId: extra.itemId,
      orderId: null,
      reportId: null,
      movementType: 'ADJUSTMENT',
      quantity: randomChoice([-2, -1, 1, 2]),
      performedBy: randomChoice(managers).userId,
      notes: 'Điều chỉnh tồn kho định kỳ sau kiểm kê',
    });
  }

  await prisma.inventoryMovement.createMany({
    data: inventoryMovements.map((m) => ({
      movementId: genId(),
      itemId: m.itemId,
      orderId: m.orderId,
      reportId: m.reportId,
      movementType: m.movementType,
      quantity: m.quantity,
      performedBy: m.performedBy,
      notes: m.notes,
    })),
  });
  console.log(`  - Inventory cho ${items.length} items, ${inventoryMovements.length} inventory movements`);

  console.log('Seed data generated successfully.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
