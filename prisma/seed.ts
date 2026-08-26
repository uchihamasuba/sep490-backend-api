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
  { username: 'Admin', fullName: 'Nguyễn Văn An', role: 'ADMIN', phone: '0901111001', email: 'kietleedinh@gmail.com' },
  { username: 'Manager', fullName: 'Lê Hoàng Nam', role: 'MANAGER', jobTitle: 'Trưởng phòng Kinh doanh', phone: '0902222001', email: 'HuyLDHE186829@fpt.edu.vn' },
  { username: 'Staff1', fullName: 'Vũ Đức Thắng', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0903333001', email: 'tanglm.vtm@gmail.com' },
  { username: 'Staff2', fullName: 'Hoàng Văn Long', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0903333002', email: 'tiennahe170636@fpt.edu.vn' },
  { username: 'Staff3', fullName: 'Ngô Thị Lan', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0903333003', email: 'sinhld.lvh@gmail.com' },
  { username: 'Staff4', fullName: 'Bùi Quang Huy', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0903333004', email: 'huydinhlee1605@gmail.com' },
  { username: 'Staff5', fullName: 'Đặng Văn Sơn', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444001', email: 'staff5@bnwevents.vn' },
  { username: 'Staff6', fullName: 'Phan Thị Mai', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444002', email: 'staff6@bnwevents.vn' },
  { username: 'Staff7', fullName: 'Trịnh Văn Hùng', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444003', email: 'staff7@bnwevents.vn' },
  { username: 'Staff8', fullName: 'Lý Thị Thu', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444004', email: 'staff8@bnwevents.vn' },
  { username: 'Staff9', fullName: 'Đinh Văn Phúc', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444005', email: 'staff9@bnwevents.vn' },
  { username: 'Staff10', fullName: 'Dương Thị Nga', role: 'STAFF', jobTitle: 'Nhân viên sự kiện', phone: '0904444006', email: 'staff10@bnwevents.vn' },
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
  { code: 'CAN-15', name: 'Phí huỷ đơn trước sự kiện 7 ngày', type: 'CANCELLATION', value: 15, unit: 'PERCENT', description: 'Tính trên tổng giá trị đơn hàng nếu khách huỷ trong vòng 7 ngày trước sự kiện.' },
  { code: 'COM-100', name: 'Đền bù thiết bị hư hỏng / mất mát', type: 'COMPENSATION', value: 100, unit: 'PERCENT', description: 'Đền bù 100% giá trị mua mới cho thiết bị hư hỏng hoặc thất lạc sau sự kiện.' },
  { code: 'FEE-CHANGE-DATE', name: 'Phí đổi ngày sự kiện trước 3 ngày', type: 'FEE', value: 10, unit: 'PERCENT', description: 'Phí áp dụng khi khách hàng yêu cầu đổi ngày tổ chức trong vòng 3 ngày trước sự kiện.' },
];

interface CategorySeed {
  code: string;
  name: string;
}

const CATEGORIES_SEED: CategorySeed[] = [
  { code: 'CAT-FURNITURE', name: 'Bàn ghế & Phụ kiện' },
  { code: 'CAT-AV', name: 'Âm thanh & Ánh sáng' },
  { code: 'CAT-TENT', name: 'Khung nhà rạp & Bạt che' },
  { code: 'CAT-COOLING', name: 'Thiết bị làm mát' },
  { code: 'CAT-DECOR', name: 'Trang trí & Phông bạt' },
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
  { code: 'TYPE-FURNITURE-SET', name: 'Bộ bàn ghế', categoryCode: 'CAT-FURNITURE' },
  { code: 'TYPE-LINEN', name: 'Khăn & Phụ kiện ghế', categoryCode: 'CAT-FURNITURE' },

  // Âm thanh & Ánh sáng
  { code: 'TYPE-AUDIO', name: 'Âm thanh', categoryCode: 'CAT-AV' },
  { code: 'TYPE-LIGHT', name: 'Đèn trang trí & Sân khấu', categoryCode: 'CAT-AV' },
  { code: 'TYPE-AUDIO-SET', name: 'Hệ thống loa đài cơ bản', categoryCode: 'CAT-AV' },

  // Khung nhà rạp & Bạt che
  { code: 'TYPE-TARPAULIN', name: 'Bạt che', categoryCode: 'CAT-TENT' },
  { code: 'TYPE-JOINT', name: 'Khớp nối', categoryCode: 'CAT-TENT' },
  { code: 'TYPE-FRAME', name: 'Khung sắt', categoryCode: 'CAT-TENT' },
  { code: 'TYPE-TENT-SET', name: 'Khung rạp & Bạt che', categoryCode: 'CAT-TENT' },
  { code: 'TYPE-CURTAIN', name: 'Rạp & Trần', categoryCode: 'CAT-TENT' },

  // Thiết bị làm mát
  { code: 'TYPE-FAN', name: 'Quạt', categoryCode: 'CAT-COOLING' },

  // Trang trí & Phông bạt
  { code: 'TYPE-ARCH', name: 'Cổng hoa', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-FLOWER', name: 'Hoa lụa', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-BACKDROP', name: 'Phông cưới hỏi', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-GALLERY', name: 'Phụ kiện Gallery', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-BACKDROP-SET', name: 'Phông cưới hỏi cơ bản', categoryCode: 'CAT-DECOR' },
];

const ITEMS_SEED: ItemSeed[] = [
  // Bàn
  { code: 'ITEM-TBL-L', name: 'Bàn loại to', typeCode: 'TYPE-TABLE', unit: 'cái', rentalPrice: 100000, purchasePrice: 1800000, bulk: true },
  { code: 'ITEM-TBL-S', name: 'Bàn loại nhỏ', typeCode: 'TYPE-TABLE', unit: 'cái', rentalPrice: 80000, purchasePrice: 1500000, bulk: true },
  // Ghế
  { code: 'ITEM-CHR-STL', name: 'Ghế đẩu', typeCode: 'TYPE-CHAIR', unit: 'cái', rentalPrice: 10000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-CHR-INOX', name: 'Ghế inox', typeCode: 'TYPE-CHAIR', unit: 'cái', rentalPrice: 15000, purchasePrice: 150000, bulk: true },
  { code: 'ITEM-CHR-CHIA', name: 'Ghế chiavari', typeCode: 'TYPE-CHAIR', unit: 'cái', rentalPrice: 35000, purchasePrice: 450000, bulk: true },
  // Khăn & Phụ kiện ghế
  { code: 'ITEM-LIN-RED', name: 'Khăn màu đỏ', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-YEL', name: 'Khăn màu vàng', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-WHI', name: 'Khăn màu trắng', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-BLU', name: 'Khăn màu xanh dương', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-GRN', name: 'Khăn màu rêu', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-LIN-RUN', name: 'Runner (dải vải trải dọc giữa bàn)', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 15000, purchasePrice: 80000, bulk: true },
  { code: 'ITEM-LIN-CHR', name: 'Áo ghế', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 10000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-LIN-BOW', name: 'Nơ ghế', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 5000, purchasePrice: 20000, bulk: true },
  { code: 'ITEM-UTE-CUP', name: 'Cốc', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 2000, purchasePrice: 15000, bulk: true },
  { code: 'ITEM-UTE-BOWL', name: 'Chén', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 2000, purchasePrice: 15000, bulk: true },
  { code: 'ITEM-UTE-POT', name: 'Ấm nước', typeCode: 'TYPE-LINEN', unit: 'cái', rentalPrice: 10000, purchasePrice: 80000, bulk: true },
  // Bộ bàn ghế
  { code: 'PKG-FURNITURE', name: 'Bộ bàn ghế tiệc cưới', typeCode: 'TYPE-FURNITURE-SET', unit: 'bộ', rentalPrice: 500000, purchasePrice: 0, bulk: true },

  // Âm thanh
  { code: 'ITEM-AUD-LA', name: 'Loa Line Array', typeCode: 'TYPE-AUDIO', unit: 'cái', rentalPrice: 500000, purchasePrice: 15000000, bulk: false },
  { code: 'ITEM-AUD-SUB', name: 'Loa Sub', typeCode: 'TYPE-AUDIO', unit: 'cái', rentalPrice: 400000, purchasePrice: 10000000, bulk: false },
  { code: 'ITEM-AUD-MON', name: 'Loa Monitor', typeCode: 'TYPE-AUDIO', unit: 'cái', rentalPrice: 300000, purchasePrice: 8000000, bulk: false },
  { code: 'ITEM-AUD-MIC', name: 'Micro không dây', typeCode: 'TYPE-AUDIO', unit: 'cái', rentalPrice: 100000, purchasePrice: 2000000, bulk: false },
  // Đèn trang trí & Sân khấu
  { code: 'ITEM-LGT-20M', name: 'Đèn chạy dọc 20m', typeCode: 'TYPE-LIGHT', unit: 'cái', rentalPrice: 100000, purchasePrice: 500000, bulk: true },
  { code: 'ITEM-LGT-BRD', name: 'Đèn chim', typeCode: 'TYPE-LIGHT', unit: 'cái', rentalPrice: 50000, purchasePrice: 200000, bulk: true },
  { code: 'ITEM-LGT-CHA', name: 'Đèn chùm', typeCode: 'TYPE-LIGHT', unit: 'cái', rentalPrice: 200000, purchasePrice: 1500000, bulk: true },
  { code: 'ITEM-LGT-BLK', name: 'Đèn nhấp nháy', typeCode: 'TYPE-LIGHT', unit: 'cái', rentalPrice: 20000, purchasePrice: 80000, bulk: true },
  { code: 'ITEM-LGT-STG', name: 'Đèn Par LED sân khấu', typeCode: 'TYPE-LIGHT', unit: 'cái', rentalPrice: 120000, purchasePrice: 2500000, bulk: false },
  // Hệ thống loa đài cơ bản
  { code: 'PKG-AUDIO', name: 'Combo loa đài', typeCode: 'TYPE-AUDIO-SET', unit: 'bộ', rentalPrice: 1500000, purchasePrice: 0, bulk: false },

  // Bạt che
  { code: 'ITEM-TARP-3X4', name: 'Bạt trắng 3 x 4', typeCode: 'TYPE-TARPAULIN', unit: 'cái', rentalPrice: 50000, purchasePrice: 300000, bulk: true },
  { code: 'ITEM-TARP-4X4', name: 'Bạt trắng 4 x 4', typeCode: 'TYPE-TARPAULIN', unit: 'cái', rentalPrice: 70000, purchasePrice: 350000, bulk: true },
  { code: 'ITEM-TARP-4X5', name: 'Bạt trắng 4 x 5', typeCode: 'TYPE-TARPAULIN', unit: 'cái', rentalPrice: 80000, purchasePrice: 400000, bulk: true },
  { code: 'ITEM-TARP-6X3', name: 'Bạt trắng 6 x 3', typeCode: 'TYPE-TARPAULIN', unit: 'cái', rentalPrice: 80000, purchasePrice: 400000, bulk: true },
  { code: 'ITEM-TARP-6X4', name: 'Bạt trắng 6 x 4', typeCode: 'TYPE-TARPAULIN', unit: 'cái', rentalPrice: 100000, purchasePrice: 500000, bulk: true },
  { code: 'ITEM-TARP-6X5', name: 'Bạt trắng 6 x 5', typeCode: 'TYPE-TARPAULIN', unit: 'cái', rentalPrice: 120000, purchasePrice: 600000, bulk: true },
  // Khớp nối
  { code: 'ITEM-JNT-CRS', name: 'Mấu dấu +', typeCode: 'TYPE-JOINT', unit: 'cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-RAF', name: 'Mấu lắp kèo', typeCode: 'TYPE-JOINT', unit: 'cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-ROOF', name: 'Mấu lắp nóc', typeCode: 'TYPE-JOINT', unit: 'cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-STR', name: 'Mấu nối 2 thanh sắt', typeCode: 'TYPE-JOINT', unit: 'cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-ANG', name: 'Mấu nối góc', typeCode: 'TYPE-JOINT', unit: 'cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-JNT-TOP', name: 'Mấu nối thanh xà trên', typeCode: 'TYPE-JOINT', unit: 'cái', rentalPrice: 5000, purchasePrice: 50000, bulk: true },
  // Khung sắt
  { code: 'ITEM-FRM-COL', name: 'Cột chống', typeCode: 'TYPE-FRAME', unit: 'cái', rentalPrice: 35000, purchasePrice: 250000, bulk: true },
  { code: 'ITEM-FRM-RAF', name: 'Kèo', typeCode: 'TYPE-FRAME', unit: 'cái', rentalPrice: 40000, purchasePrice: 300000, bulk: true },
  { code: 'ITEM-FRM-25', name: 'Thanh sắt 2.5m', typeCode: 'TYPE-FRAME', unit: 'cái', rentalPrice: 20000, purchasePrice: 150000, bulk: true },
  { code: 'ITEM-FRM-3M', name: 'Thanh sắt 3m', typeCode: 'TYPE-FRAME', unit: 'cái', rentalPrice: 25000, purchasePrice: 180000, bulk: true },
  { code: 'ITEM-FRM-4M', name: 'Thanh sắt 4m', typeCode: 'TYPE-FRAME', unit: 'cái', rentalPrice: 30000, purchasePrice: 220000, bulk: true },
  { code: 'ITEM-FRM-ROOF', name: 'Thanh sắt lắp nóc', typeCode: 'TYPE-FRAME', unit: 'cái', rentalPrice: 25000, purchasePrice: 180000, bulk: true },
  // Rạp & Trần
  { code: 'ITEM-CUR-ROOF', name: 'Quây trần nhà', typeCode: 'TYPE-CURTAIN', unit: 'cái', rentalPrice: 15000, purchasePrice: 70000, bulk: true },
  { code: 'ITEM-CUR-RED', name: 'Rèm quây xung quanh màu đỏ', typeCode: 'TYPE-CURTAIN', unit: 'cái', rentalPrice: 10000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-CUR-BLU', name: 'Rèm quây xung quanh màu xanh dương', typeCode: 'TYPE-CURTAIN', unit: 'cái', rentalPrice: 10000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-CUR-WHI', name: 'Rèm quây xung quanh màu trắng', typeCode: 'TYPE-CURTAIN', unit: 'cái', rentalPrice: 10000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-CUR-YEL', name: 'Rèm quây xung quanh màu vàng', typeCode: 'TYPE-CURTAIN', unit: 'cái', rentalPrice: 10000, purchasePrice: 50000, bulk: true },
  { code: 'ITEM-CUR-WAV', name: 'Rèm tạo sóng', typeCode: 'TYPE-CURTAIN', unit: 'cái', rentalPrice: 15000, purchasePrice: 70000, bulk: true },
  { code: 'ITEM-CAR-GRASS', name: 'Thảm cỏ', typeCode: 'TYPE-CURTAIN', unit: 'cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-CAR-RED', name: 'Thảm đỏ', typeCode: 'TYPE-CURTAIN', unit: 'cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  // Khung rạp & Bạt che
  { code: 'PKG-TENT', name: 'Khung rạp cơ bản', typeCode: 'TYPE-TENT-SET', unit: 'bộ', rentalPrice: 2000000, purchasePrice: 0, bulk: true },

  // Quạt
  { code: 'ITEM-FAN-IND', name: 'Quạt công nghiệp', typeCode: 'TYPE-FAN', unit: 'cái', rentalPrice: 100000, purchasePrice: 800000, bulk: true },
  { code: 'ITEM-FAN-WAT', name: 'Quạt hơi nước', typeCode: 'TYPE-FAN', unit: 'cái', rentalPrice: 250000, purchasePrice: 3500000, bulk: true },

  // Cổng hoa
  { code: 'ITEM-ARC-HEX', name: 'Cổng hoa hình lục giác', typeCode: 'TYPE-ARCH', unit: 'cái', rentalPrice: 900000, purchasePrice: 4000000, bulk: true },
  { code: 'ITEM-ARC-CIR', name: 'Cổng hoa khung tròn', typeCode: 'TYPE-ARCH', unit: 'cái', rentalPrice: 800000, purchasePrice: 3500000, bulk: true },
  { code: 'ITEM-ARC-SQU', name: 'Cổng hoa khung vuông', typeCode: 'TYPE-ARCH', unit: 'cái', rentalPrice: 800000, purchasePrice: 3500000, bulk: true },
  { code: 'ITEM-ARC-IRN', name: 'Cổng vòm sắt', typeCode: 'TYPE-ARCH', unit: 'cái', rentalPrice: 700000, purchasePrice: 3000000, bulk: true },
  { code: 'ITEM-ARC-PLA', name: 'Cổng vòm nhựa', typeCode: 'TYPE-ARCH', unit: 'cái', rentalPrice: 700000, purchasePrice: 3000000, bulk: true },
  // Hoa lụa
  { code: 'ITEM-FLW-RED', name: 'Hoa giả tone đỏ', typeCode: 'TYPE-FLOWER', unit: 'cái', rentalPrice: 50000, purchasePrice: 200000, bulk: true },
  { code: 'ITEM-FLW-PAS', name: 'Hoa giả tone hồng pastel', typeCode: 'TYPE-FLOWER', unit: 'cái', rentalPrice: 50000, purchasePrice: 200000, bulk: true },
  { code: 'ITEM-FLW-SUC', name: 'Hoa giả tone sen đá', typeCode: 'TYPE-FLOWER', unit: 'cái', rentalPrice: 60000, purchasePrice: 250000, bulk: true },
  { code: 'ITEM-FLW-WHI', name: 'Hoa giả tone trắng', typeCode: 'TYPE-FLOWER', unit: 'cái', rentalPrice: 50000, purchasePrice: 200000, bulk: true },
  // Phông cưới hỏi
  { code: 'ITEM-BKG-XOP', name: 'Tấm xốp', typeCode: 'TYPE-BACKDROP', unit: 'tấm', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'ITEM-BKG-LGT', name: 'Đèn sân khấu', typeCode: 'TYPE-BACKDROP', unit: 'cái', rentalPrice: 100000, purchasePrice: 400000, bulk: true },
  { code: 'ITEM-BKG-CUR', name: 'Phông quây', typeCode: 'TYPE-BACKDROP', unit: 'cái', rentalPrice: 15000, purchasePrice: 70000, bulk: true },
  { code: 'ITEM-BKG-TRP', name: 'Tráp cưới', typeCode: 'TYPE-BACKDROP', unit: 'cái', rentalPrice: 100000, purchasePrice: 500000, bulk: true },
  // Phụ kiện Gallery
  { code: 'ITEM-GAL-VAS', name: 'Bình hoa thủy tinh', typeCode: 'TYPE-GALLERY', unit: 'cái', rentalPrice: 30000, purchasePrice: 150000, bulk: true },
  { code: 'ITEM-GAL-HOU', name: 'Hòm tiền mừng (hình ngôi nhà)', typeCode: 'TYPE-GALLERY', unit: 'cái', rentalPrice: 150000, purchasePrice: 600000, bulk: true },
  { code: 'ITEM-GAL-BOX', name: 'Hòm tiền mừng (hòm thư)', typeCode: 'TYPE-GALLERY', unit: 'cái', rentalPrice: 150000, purchasePrice: 600000, bulk: true },
  { code: 'ITEM-GAL-MIC', name: 'Hoa tiền mừng (mica trong suốt)', typeCode: 'TYPE-GALLERY', unit: 'cái', rentalPrice: 200000, purchasePrice: 800000, bulk: true },
  { code: 'ITEM-GAL-TR2', name: 'Khay 2 tầng sứ', typeCode: 'TYPE-GALLERY', unit: 'cái', rentalPrice: 60000, purchasePrice: 300000, bulk: true },
  { code: 'ITEM-GAL-TR3', name: 'Khay 3 tầng', typeCode: 'TYPE-GALLERY', unit: 'cái', rentalPrice: 50000, purchasePrice: 250000, bulk: true },
  { code: 'ITEM-GAL-TRW', name: 'Khay gỗ', typeCode: 'TYPE-GALLERY', unit: 'cái', rentalPrice: 30000, purchasePrice: 150000, bulk: true },
  { code: 'ITEM-GAL-FRM', name: 'Khung ảnh trang trí', typeCode: 'TYPE-GALLERY', unit: 'cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  // Phông cưới hỏi cơ bản
  { code: 'PKG-BACKDROP', name: 'Combo Phông cưới & Tráp', typeCode: 'TYPE-BACKDROP-SET', unit: 'bộ', rentalPrice: 1500000, purchasePrice: 0, bulk: true },
];

const ITEM_COMPONENTS_SEED: ComponentSeed[] = [
  // PKG-FURNITURE
  { parentCode: 'PKG-FURNITURE', childCode: 'ITEM-TBL-L', quantity: 1 },
  { parentCode: 'PKG-FURNITURE', childCode: 'ITEM-CHR-CHIA', quantity: 6 },
  { parentCode: 'PKG-FURNITURE', childCode: 'ITEM-LIN-CHR', quantity: 6 },
  { parentCode: 'PKG-FURNITURE', childCode: 'ITEM-LIN-BOW', quantity: 6 },
  { parentCode: 'PKG-FURNITURE', childCode: 'ITEM-LIN-RUN', quantity: 1 },
  { parentCode: 'PKG-FURNITURE', childCode: 'ITEM-LIN-RED', quantity: 1 },

  // PKG-AUDIO
  { parentCode: 'PKG-AUDIO', childCode: 'ITEM-AUD-LA', quantity: 1 },
  { parentCode: 'PKG-AUDIO', childCode: 'ITEM-AUD-SUB', quantity: 1 },
  { parentCode: 'PKG-AUDIO', childCode: 'ITEM-AUD-MON', quantity: 1 },
  { parentCode: 'PKG-AUDIO', childCode: 'ITEM-AUD-MIC', quantity: 2 },

  // PKG-TENT
  { parentCode: 'PKG-TENT', childCode: 'ITEM-FRM-25', quantity: 10 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-FRM-3M', quantity: 10 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-FRM-4M', quantity: 10 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-FRM-ROOF', quantity: 10 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-FRM-COL', quantity: 20 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-FRM-RAF', quantity: 6 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-JNT-CRS', quantity: 5 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-JNT-RAF', quantity: 5 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-JNT-ROOF', quantity: 5 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-JNT-STR', quantity: 5 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-JNT-ANG', quantity: 5 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-JNT-TOP', quantity: 5 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-TARP-6X5', quantity: 2 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-CUR-WAV', quantity: 10 },
  { parentCode: 'PKG-TENT', childCode: 'ITEM-CAR-RED', quantity: 2 },

  // PKG-BACKDROP
  { parentCode: 'PKG-BACKDROP', childCode: 'ITEM-BKG-XOP', quantity: 10 },
  { parentCode: 'PKG-BACKDROP', childCode: 'ITEM-BKG-LGT', quantity: 3 },
  { parentCode: 'PKG-BACKDROP', childCode: 'ITEM-BKG-CUR', quantity: 5 },
  { parentCode: 'PKG-BACKDROP', childCode: 'ITEM-BKG-TRP', quantity: 5 },
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
  { code: 'SUP-002', name: 'Kho Bàn Ghế & Phụ Kiện Thành Công', serviceType: 'Bàn ghế tiệc, khăn, áo ghế, dụng cụ ăn uống', contactPerson: 'Trần Văn Đạt', phone: '0933333002', email: 'thanhcong@gmail.com', address: '34 Cầu Giấy, Hà Nội', rating: 4.2 },
  { code: 'SUP-003', name: 'Vựa Hoa & Trang Trí Lan Anh', serviceType: 'Cổng hoa, hoa lụa, phụ kiện gallery, phông cưới', contactPerson: 'Nguyễn Thị Lan Anh', phone: '0933333004', email: 'lananhflower@gmail.com', address: '78 Hoàng Hoa Thám, Hà Nội', rating: 4.9 },
  { code: 'SUP-004', name: 'Xưởng Điện Nước Toàn Phát', serviceType: 'Quạt công nghiệp, quạt hơi nước', contactPerson: 'Lê Thị Hạnh', phone: '0933333003', email: 'toanphat@gmail.com', address: '56 Phạm Văn Đồng, Hà Nội', rating: 4.7 },
  { code: 'SUP-005', name: 'Âm Thanh Ánh Sáng Nam Việt', serviceType: 'Đèn trang trí, hệ thống loa đài', contactPerson: 'Phạm Văn Sơn', phone: '0933333005', email: 'namviet@gmail.com', address: '90 Nguyễn Chí Thanh, Hà Nội', rating: 4.6 },
  { code: 'SUP-006', name: 'Đơn Vị In Ấn Thiệp & Phông', serviceType: 'Chữ trên phông, in ấn', contactPerson: 'Đặng Thị Thu', phone: '0933333006', email: 'inanthiep@gmail.com', address: '23 Trần Duy Hưng, Cầu Giấy, Hà Nội', rating: 4.6 },
  { code: 'SUP-007', name: 'Công ty CP Vận Tải Sự Kiện Nhanh', serviceType: 'Vận chuyển thiết bị sự kiện', contactPerson: 'Bùi Văn Khoa', phone: '0933333007', email: 'nhanhtransport@gmail.com', address: '45 Giải Phóng, Hoàng Mai, Hà Nội', rating: 4.0 },
];

interface CustomerSeed extends PartySeed {
  type: 'PERSONAL' | 'CORPORATE';
}

const CUSTOMERS_SEED: CustomerSeed[] = [
  { code: 'CUS-001', name: 'Nguyễn Thu Hà', phone: '0901112233', email: 'thuha.ng@gmail.com', address: 'KĐT Times City, Hai Bà Trưng, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-002', name: 'Trần Khắc Hiếu', phone: '0912223344', email: 'hieutk88@yahoo.com', address: '45 Hoàng Cầu, Đống Đa, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-003', name: 'Lê Thị Cẩm Tú', phone: '0983334455', email: 'camtu.le95@gmail.com', address: '120 Cầu Giấy, Quận Cầu Giấy, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-004', name: 'Đinh Trọng Đạt', phone: '0934445566', email: 'dat.dinh@gmail.com', address: 'KĐT Vinhomes Royal City, Thanh Xuân, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-005', name: 'Phạm Mai Phương', phone: '0975556677', email: 'phuongpham.beauty@gmail.com', address: '88 Xã Đàn, Đống Đa, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-006', name: 'Vũ Thùy Linh', phone: '0906667788', email: 'thuylinh.vu@hotmail.com', address: 'KĐT Ciputra, Tây Hồ, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-007', name: 'Hoàng Gia Bảo', phone: '0917778899', email: 'giabao.hoang@gmail.com', address: '200 Nguyễn Trãi, Thanh Xuân, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-008', name: 'Bùi Xuân Trường', phone: '0941122334', email: 'truongbx.arch@gmail.com', address: '15 Tôn Thất Thuyết, Nam Từ Liêm, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-009', name: 'Ngô Minh Phương', phone: '0989988776', email: 'minhphuong.ngo90@yahoo.com', address: '35 Kim Mã, Ba Đình, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-010', name: 'Đặng Mỹ Hạnh', phone: '0932233445', email: 'hanh.dangmy@gmail.com', address: '102 Lò Đúc, Hai Bà Trưng, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-011', name: 'Phan Thanh Bình', phone: '0965566778', email: 'thanhbinh.phan@hotmail.com', address: 'KĐT Việt Hưng, Long Biên, Hà Nội', type: 'PERSONAL' },
  { code: 'CUS-012', name: 'Trịnh Phương Nam', phone: '0908877665', email: 'nam.trinhphuong@gmail.com', address: '22 Quang Trung, Hà Đông, Hà Nội', type: 'PERSONAL' },
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
  'Đám cưới',
  'Lễ ăn hỏi',
];

const COMPLEX_EVENT_TYPES = new Set(['Hội nghị doanh nghiệp', 'Hội thảo chuyên đề', 'Gala Dinner', 'Lễ ra mắt sản phẩm', 'Đám cưới', 'Tiệc cưới']);

const VENUES = [
  { name: 'Sân Nhà văn hóa Tổ dân phố 3, Phường Kiến Hưng, Hà Đông', lat: 20.9461, lng: 105.7952 },
  { name: 'Sân bóng cỏ nhân tạo Kiến Hưng, Hà Đông', lat: 20.9431, lng: 105.7981 },
  { name: 'Số 15, Ngõ 42, Phố Triều Khúc, Thanh Trì', lat: 20.9813, lng: 105.7984 },
  { name: 'Nhà văn hóa Thôn Lỗ Khê, Liên Hà, Đông Anh', lat: 21.1569, lng: 105.8869 },
  { name: 'Số 8, Ngõ 120, Cầu Diễn, Bắc Từ Liêm', lat: 21.0421, lng: 105.7511 },
  { name: 'Sân chung cư CT1, KĐT Đặng Xá, Gia Lâm', lat: 21.0187, lng: 105.9435 },
  { name: 'Sân đình làng Phú Đô, Nam Từ Liêm', lat: 21.0113, lng: 105.7722 },
  { name: 'Số 25, Ngõ 68, Ngọc Thụy, Long Biên', lat: 21.0561, lng: 105.8611 },
  { name: 'Nhà văn hóa Phường Phú La, Hà Đông', lat: 20.9571, lng: 105.7711 },
  { name: 'Sân vận động xã Nam Hồng, Đông Anh', lat: 21.1661, lng: 105.8018 },
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
  const compensationPolicy = policies.find((p: any) => p.policyCode === 'COM-100')!;
  const feePolicy = policies.find((p: any) => p.policyCode === 'FEE-CHANGE-DATE')!;

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
  await prisma.customer.createMany({
    data: CUSTOMERS_SEED.map((c) => ({
      customerId: genId(),
      customerCode: c.code,
      customerName: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
    })),
  });
  const customerRows = await prisma.customer.findMany();
  const customers: CreatedParty[] = customerRows.map((c: any) => ({ id: c.customerId, code: c.customerCode, name: c.customerName }));

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
  const basicItems = items.filter(i => !i.code.startsWith('PKG-'));

  // 1. Đảm bảo mọi item không phải combo đều có ít nhất 1 nhà cung cấp
  for (const item of basicItems) {
    const supplier = randomChoice(suppliers);
    supplierItemsData.push({
      supplierId: supplier.id,
      itemId: item.itemId,
      rentalPrice: round2(item.rentalPrice * 0.8),
      purchasePrice: round2(item.purchasePrice * 0.8),
      isActive: true,
      minQuantity: item.bulk ? randomInt(10, 50) : randomInt(1, 5),
      supplierItemCode: `SIC-${supplier.code}-${item.code}`,
    });
  }

  // 2. Gán thêm 2-5 item ngẫu nhiên cho mỗi nhà cung cấp
  for (const supplier of suppliers) {
    const numItems = randomInt(2, 5);
    const assignedItems = sample(basicItems, numItems);
    for (const item of assignedItems) {
      if (!supplierItemsData.find(si => si.supplierId === supplier.id && si.itemId === item.itemId)) {
        supplierItemsData.push({
          supplierId: supplier.id,
          itemId: item.itemId,
          rentalPrice: round2(item.rentalPrice * 0.8),
          purchasePrice: round2(item.purchasePrice * 0.8),
          isActive: true,
          minQuantity: item.bulk ? randomInt(10, 50) : randomInt(1, 5),
          supplierItemCode: `SIC-${supplier.code}-${item.code}`,
        });
      }
    }
  }
  await prisma.supplierItem.createMany({
    data: supplierItemsData,
    skipDuplicates: true, // Just in case
  });

  console.log(`  - ${customers.length} customers, ${suppliers.length} suppliers, ${supplierItemsData.length} supplier items`);

  // ==========================================================================
  // WORK TASKS (Cần chạy trước Orders để lấy taskId)
  // ==========================================================================
  const taskIdByCode = new Map<string, string>();
  await prisma.workTask.createMany({
    data: WORK_TASKS_SEED.map((t) => {
      const id = genId();
      taskIdByCode.set(t.code, id);
      return { taskId: id, taskCode: t.code, taskName: t.name };
    }),
  });

  // ==========================================================================
  // 5. ORDERS & ORDER ITEMS
  // ==========================================================================
  const orderConfigs = [
    { code: 'CUS-001', type: 'Đám cưới', side: 'Nhà gái', status: 'COMPLETED', offset: -10 },
    { code: 'CUS-002', type: 'Đám cưới', side: 'Nhà trai', status: 'COMPLETED', offset: -15 },
    { code: 'CUS-003', type: 'Lễ ăn hỏi', side: 'Nhà gái', status: 'COMPLETED', offset: -30 },
    { code: 'CUS-004', type: 'Tiệc sinh nhật', side: null, status: 'COMPLETED', offset: -20 },
    { code: 'CUS-005', type: 'Tiệc cưới', side: 'Nhà trai', status: 'COMPLETED', offset: -60 },
    { code: 'CUS-006', type: 'Tiệc cưới', side: 'Nhà gái', status: 'COMPLETED', offset: -90 },
    { code: 'CUS-007', type: 'Tiệc sinh nhật', side: null, status: 'COMPLETED', offset: -45 },
    { code: 'CUS-008', type: 'Lễ ăn hỏi', side: 'Nhà trai', status: 'COMPLETED', offset: -50 },
    { code: 'CUS-009', type: 'Tiệc cưới', side: 'Nhà trai', status: 'CONFIRMED', offset: 7 },
    { code: 'CUS-010', type: 'Đám cưới', side: 'Nhà gái', status: 'CONFIRMED', offset: 14 },
    { code: 'CUS-011', type: 'Lễ ăn hỏi', side: 'Nhà trai', status: 'CANCELLED', offset: -5 },
    { code: 'CUS-012', type: 'Tiệc sinh nhật', side: null, status: 'CANCELLED', offset: -2 },
  ];

  const quotationsData: any[] = [];
  const quotationItemsData: any[] = [];
  const ordersData: any[] = [];
  const orderItemsData: any[] = [];
  const schedulePlansData: any[] = [];
  const scheduleAssigneesData: any[] = [];
  const depositsData: any[] = [];
  const settlementsData: any[] = [];
  const evidencesData: any[] = [];
  const depositEvidencesData: any[] = [];
  const settlementEvidencesData: any[] = [];
  const supplierTransactionsData: any[] = [];
  const supplierTransactionItemsData: any[] = [];
  const inventoryReservationsData: any[] = [];
  const surveyReportsData: any[] = [];
  const surveyReportEvidencesData: any[] = [];

  // 9. INVENTORY — 1 dòng cho TOÀN BỘ items (available + reserved + damaged = total)
  // Thực hiện TRƯỚC khi tạo đơn hàng để reservation có thể cap theo quantityTotal
  const inventoryData: any[] = [];
  const inventoryTotalMap = new Map<string, number>();
  for (const it of items) {
    const quantityTotal = it.bulk ? randomInt(50, 200) : randomInt(10, 30);
    inventoryTotalMap.set(it.itemId, quantityTotal);
    inventoryData.push({
      inventoryId: genId(),
      itemId: it.itemId,
      quantityTotal,
      quantityDamaged: 0,
    });
  }

  let orderSeq = 1;
  let planSeq = 1;
  let depositSeq = 1;
  let stxSeq = 1;
  let surveySeq = 1;
  for (const config of orderConfigs) {
    const customer = customers.find(c => c.code === config.code);
    if (!customer) continue;

    const quotationId = genId();
    const quotationCode = `QT-${pad(orderSeq, 3)}`;
    const orderId = genId();
    const eventDate = addDays(TODAY, config.offset);
    const orderCode = `ORD-${pad(orderSeq++, 3)}`;

    const selectedItemCodes: { code: string, qty: number }[] = [];
    if (['Đám cưới', 'Tiệc cưới', 'Lễ ăn hỏi'].includes(config.type)) {
      selectedItemCodes.push({ code: 'PKG-TENT', qty: 1 });
      selectedItemCodes.push({ code: 'PKG-BACKDROP', qty: 1 });
      selectedItemCodes.push({ code: 'PKG-FURNITURE', qty: randomInt(10, 30) });
      selectedItemCodes.push({ code: 'PKG-AUDIO', qty: 1 });
      selectedItemCodes.push({ code: 'ITEM-FAN-IND', qty: randomInt(4, 10) });
      selectedItemCodes.push({ code: 'ITEM-ARC-HEX', qty: 1 });
      selectedItemCodes.push({ code: 'ITEM-GAL-BOX', qty: 1 });
      selectedItemCodes.push({ code: 'ITEM-GAL-FRM', qty: 5 });
    } else if (config.type === 'Tiệc sinh nhật') {
      selectedItemCodes.push({ code: 'PKG-FURNITURE', qty: randomInt(3, 10) });
      selectedItemCodes.push({ code: 'PKG-AUDIO', qty: 1 });
      selectedItemCodes.push({ code: 'ITEM-BKG-XOP', qty: 5 });
      selectedItemCodes.push({ code: 'ITEM-LGT-BLK', qty: 10 });
      selectedItemCodes.push({ code: 'ITEM-FAN-WAT', qty: 2 });
    } else {
      selectedItemCodes.push({ code: 'PKG-FURNITURE', qty: randomInt(5, 15) });
      selectedItemCodes.push({ code: 'PKG-AUDIO', qty: 1 });
      selectedItemCodes.push({ code: 'ITEM-FAN-WAT', qty: 4 });
      selectedItemCodes.push({ code: 'ITEM-TARP-4X5', qty: 2 });
    }

    let totalAmount = 0;
    for (const { code, qty } of selectedItemCodes) {
      const item = items.find(i => i.code === code);
      if (!item) continue;
      const subtotal = qty * item.rentalPrice;
      totalAmount += subtotal;

      quotationItemsData.push({
        quotationItemId: genId(),
        quotationId: quotationId,
        itemId: item.itemId,
        itemName: item.name,
        quantity: qty,
        price: item.rentalPrice,
        discount: 0,
        lineTotal: subtotal,
      });

      orderItemsData.push({
        orderItemId: genId(),
        orderId: orderId,
        itemId: item.itemId,
        quantity: qty,
        unitPrice: item.rentalPrice,
        subtotal: subtotal,
      });
    }

    quotationsData.push({
      quotationId,
      quotationCode,
      customerId: customer.id,
      version: 'V1',
      subtotal: totalAmount,
      discountTotal: 0,
      totalAmount: totalAmount,
      status: config.status === 'CANCELLED' ? 'REJECTED' : 'APPROVED',
      isManagerViewed: true,
      createdBy: randomChoice(managers).userId,
      createdAt: addDays(eventDate, -25),
      updatedAt: addDays(eventDate, -25),
    });

    let paymentStatus = 'UNPAID';
    if (config.status === 'COMPLETED') paymentStatus = 'PAID';
    else if (config.status === 'CONFIRMED') paymentStatus = 'DEPOSITED';

    ordersData.push({
      orderId,
      orderCode,
      customerId: customer.id,
      quotationId: quotationId,
      policyId: compensationPolicy.policyId,
      eventType: config.type,
      eventName: config.side ? `${config.type} (${config.side}) - ${customer.name}` : `${config.type} - ${customer.name}`,
      eventDate: eventDate,
      endDate: addHours(eventDate, 4),
      location: randomChoice(VENUES).name,
      totalAmount,
      paymentStatus,
      orderStatus: config.status as OrderStatus,
      cancelReason: config.status === 'CANCELLED' ? 'Khách hàng bận việc đột xuất' : null,
      createdBy: randomChoice(managers).userId,
      createdAt: addDays(eventDate, -20),
      updatedAt: eventDate,
      confirmedAt: config.status !== 'CANCELLED' ? addDays(eventDate, -15) : null,
      closedAt: config.status === 'COMPLETED' ? addDays(eventDate, 1) : null,
      closedBy: config.status === 'COMPLETED' ? randomChoice(managers).userId : null,
    });

    let surveyPlanId: string | null = null;
    if (config.status === 'CONFIRMED' || config.status === 'COMPLETED') {
      surveyPlanId = genId();
      schedulePlansData.push({
        planId: surveyPlanId,
        planCode: `PLN-${TODAY.getFullYear()}${pad(TODAY.getMonth() + 1, 2)}-${pad(planSeq++, 4)}`,
        orderId: orderId,
        taskId: taskIdByCode.get('SURVEY')!,
        startTime: addDays(eventDate, -2),
        endTime: addDays(eventDate, -2),
        location: randomChoice(VENUES).name,
        status: config.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
        createdBy: randomChoice(managers).userId,
      });
      const surveyStaffs = sample(operationalPool, 2);
      surveyStaffs.forEach((st, idx) => {
        scheduleAssigneesData.push({
          assigneeId: genId(),
          planId: surveyPlanId,
          userId: st.userId,
          role: idx === 0 ? 'LEAD' : 'TECHNICAL',
        });
      });

      const setupPlanId = genId();
      schedulePlansData.push({
        planId: setupPlanId,
        planCode: `PLN-${TODAY.getFullYear()}${pad(TODAY.getMonth() + 1, 2)}-${pad(planSeq++, 4)}`,
        orderId: orderId,
        taskId: taskIdByCode.get('SETUP')!,
        startTime: eventDate,
        endTime: eventDate,
        location: randomChoice(VENUES).name,
        status: config.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
        createdBy: randomChoice(managers).userId,
      });
      const setupStaffs = sample(operationalPool, 3);
      setupStaffs.forEach((st, idx) => {
        scheduleAssigneesData.push({
          assigneeId: genId(),
          planId: setupPlanId,
          userId: st.userId,
          role: idx === 0 ? 'LEAD' : 'TECHNICAL',
        });
      });

      const collectPlanId = genId();
      schedulePlansData.push({
        planId: collectPlanId,
        planCode: `PLN-${TODAY.getFullYear()}${pad(TODAY.getMonth() + 1, 2)}-${pad(planSeq++, 4)}`,
        orderId: orderId,
        taskId: taskIdByCode.get('COLLECT')!,
        startTime: addDays(eventDate, 2),
        endTime: addDays(eventDate, 2),
        location: randomChoice(VENUES).name,
        status: config.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
        createdBy: randomChoice(managers).userId,
      });
      const collectStaffs = sample(operationalPool, 3);
      collectStaffs.forEach((st, idx) => {
        scheduleAssigneesData.push({
          assigneeId: genId(),
          planId: collectPlanId,
          userId: st.userId,
          role: idx === 0 ? 'LEAD' : 'TECHNICAL',
        });
      });

      // 5. Deposits and Settlements
      const depositId = genId();
      const depositAmount = totalAmount * 0.3; // 30% without relying on policy
      const depositCode = `DEP-${TODAY.getFullYear()}${pad(TODAY.getMonth() + 1, 2)}-${pad(depositSeq++, 3)}`;

      depositsData.push({
        depositId,
        depositCode,
        orderId,
        amount: depositAmount,
        dueDate: addDays(eventDate, -15),
        paymentDate: addDays(eventDate, -15),
        paymentMethod: 'CASH',
        status: 'PAID',
        requestedBy: randomChoice(managers).userId,
        approvedBy: randomChoice(managers).userId,
        approvedAt: addDays(eventDate, -15),
        createdAt: addDays(eventDate, -20),
        updatedAt: addDays(eventDate, -15),
      });

      const depEvidenceId = genId();
      evidencesData.push({
        evidenceId: depEvidenceId,
        fileUrl: 'https://placehold.co/600x400/png?text=Deposit+Evidence',
        description: 'Ảnh CK Đặt cọc',
        uploadedBy: randomChoice(managers).userId,
      });
      depositEvidencesData.push({
        depositId,
        evidenceId: depEvidenceId,
      });

      if (config.status === 'COMPLETED') {
        const settlementId = genId();
        const finalAmount = totalAmount - depositAmount;
        settlementsData.push({
          settlementId,
          orderId,
          additionalFee: 0,
          compensation: 0,
          discount: 0,
          finalAmount,
          paymentMethod: 'BANK_TRANSFER',
          paidAt: addDays(eventDate, 1),
          status: 'PAID',
          requestedBy: randomChoice(managers).userId,
          requestedAt: eventDate,
          confirmedBy: randomChoice(managers).userId,
          confirmedAt: addDays(eventDate, 1),
        });

        const setEvidenceId = genId();
        evidencesData.push({
          evidenceId: setEvidenceId,
          fileUrl: 'https://placehold.co/600x400/png?text=Settlement+Evidence',
          description: 'Ảnh CK Thanh toán',
          uploadedBy: randomChoice(managers).userId,
        });
        settlementEvidencesData.push({
          settlementId,
          evidenceId: setEvidenceId,
        });
      }

      // 6. Supplier Transactions (chỉ RENTAL cho đơn COMPLETED)
      if (config.status === 'COMPLETED') {
        const supplier = randomChoice(suppliers);
        const suppliedItems = supplierItemsData.filter(si => si.supplierId === supplier.id);

        if (suppliedItems.length > 0) {
          const transactionId = genId();
          let transactionTotal = 0;

          const numRentals = randomInt(1, 3);
          const rentedItems = sample(suppliedItems, Math.min(numRentals, suppliedItems.length));

          for (const si of rentedItems) {
            const qty = randomInt(5, 20); // Điều chỉnh số lượng item
            const subtotal = qty * si.rentalPrice;
            transactionTotal += subtotal;

            supplierTransactionItemsData.push({
              stItemId: genId(),
              transactionId,
              itemId: si.itemId,
              itemName: items.find(i => i.itemId === si.itemId)!.name,
              quantity: qty,
              unitCost: si.rentalPrice,
              subtotal,
              receivedQuantity: qty,
              notes: 'Thuê bổ sung',
            });
          }

          supplierTransactionsData.push({
            transactionId,
            transactionCode: `STX-${TODAY.getFullYear()}${pad(TODAY.getMonth() + 1, 2)}-${pad(stxSeq++, 3)}`,
            supplierId: supplier.id,
            orderId: orderId,
            transactionType: 'RENTAL',
            serviceTitle: `Thuê thiết bị bổ sung cho đơn ${orderCode}`,
            estimatedCost: transactionTotal,
            depositAmount: 0,
            paymentStatus: 'PAID',
            status: 'COMPLETED',
            createdAt: addDays(eventDate, -2),
            updatedAt: addDays(eventDate, 2),
            updatedBy: randomChoice(managers).userId,
          });
        }
      }

      // 7. Inventory Reservations
      let resStatus = 'CONFIRMED';
      if (config.status === 'COMPLETED') resStatus = 'CONSUMED';
      else if (config.status === 'CANCELLED') resStatus = 'RELEASED';

      const reservedItems = new Map<string, number>();
      for (const { code, qty } of selectedItemCodes) {
        if (code.startsWith('PKG-')) {
          const components = ITEM_COMPONENTS_SEED.filter(c => c.parentCode === code);
          for (const comp of components) {
            const childItem = items.find(i => i.code === comp.childCode);
            if (childItem) {
              reservedItems.set(childItem.itemId, (reservedItems.get(childItem.itemId) || 0) + (comp.quantity * qty));
            }
          }
        } else {
          const childItem = items.find(i => i.code === code);
          if (childItem) {
            reservedItems.set(childItem.itemId, (reservedItems.get(childItem.itemId) || 0) + qty);
          }
        }
      }

      for (const [itemId, qty] of reservedItems.entries()) {
        const total = inventoryTotalMap.get(itemId) || 0;
        const finalQty = Math.min(qty, total);
        inventoryReservationsData.push({
          reservationId: genId(),
          itemId: itemId,
          orderId: orderId,
          quotationId: quotationId,
          quantity: finalQty,
          startAt: addDays(eventDate, -1),
          endAt: new Date(addDays(eventDate, 0).getTime() + 28 * 60 * 60 * 1000), // eventDate + 28h
          status: resStatus,
          createdBy: randomChoice(managers).userId,
        });
      }

      // 8. Survey Reports (Báo cáo khảo sát)
      // Sinh báo cáo khảo sát phù hợp cho tất cả các đơn đã có báo giá
      const surveyId = genId();
      const surveyDate = addDays(eventDate, -15);

      surveyReportsData.push({
        surveyId,
        reportCode: `SRV-${TODAY.getFullYear()}${pad(TODAY.getMonth() + 1, 2)}-${pad(surveySeq++, 3)}`,
        orderId,
        planId: surveyPlanId,
        surveyDate,
        location: randomChoice(VENUES).name,
        area: randomInt(50, 200),
        length: randomInt(10, 30),
        width: randomInt(5, 15),
        entrance: 'Đường rộng, xe tải nhỏ vào được',
        siteConstraints: 'Không được đóng đinh lên tường, trần thấp',
        additionalRequests: 'Cần bạt che dự phòng trời mưa',
        proposedItems: 'Thêm 2 quạt công nghiệp cỡ lớn',
        notes: 'Khách hàng yêu cầu thi công cẩn thận',
        status: config.status === 'CANCELLED' ? 'DRAFT' : 'CONFIRMED',
        reportedBy: randomChoice(managers).userId,
        confirmedBy: config.status === 'CANCELLED' ? null : randomChoice(managers).userId,
        confirmedAt: config.status === 'CANCELLED' ? null : addDays(eventDate, -14),
        createdAt: surveyDate,
        updatedAt: addDays(eventDate, -14),
      });

      const srvEvidenceId = genId();
      evidencesData.push({
        evidenceId: srvEvidenceId,
        fileUrl: 'https://placehold.co/600x400/png?text=Survey+Evidence',
        description: 'Ảnh khảo sát hiện trường',
        uploadedBy: randomChoice(managers).userId,
      });
      surveyReportEvidencesData.push({
        surveyId,
        evidenceId: srvEvidenceId,
      });
    }
  }

  await prisma.quotation.createMany({ data: quotationsData });
  await prisma.quotationItem.createMany({ data: quotationItemsData });
  await prisma.order.createMany({ data: ordersData });
  await prisma.orderItem.createMany({ data: orderItemsData });
  await prisma.schedulePlan.createMany({ data: schedulePlansData });
  await prisma.schedulePlanAssignee.createMany({ data: scheduleAssigneesData });

  await prisma.evidence.createMany({ data: evidencesData });
  await prisma.deposit.createMany({ data: depositsData });
  await prisma.depositEvidence.createMany({ data: depositEvidencesData });
  await prisma.settlement.createMany({ data: settlementsData });
  await prisma.settlementEvidence.createMany({ data: settlementEvidencesData });

  await prisma.supplierTransaction.createMany({ data: supplierTransactionsData });
  await prisma.supplierTransactionItem.createMany({ data: supplierTransactionItemsData });

  await prisma.inventoryReservation.createMany({ data: inventoryReservationsData });

  await prisma.surveyReport.createMany({ data: surveyReportsData });
  await prisma.surveyReportEvidence.createMany({ data: surveyReportEvidencesData });

  console.log(`  - Created ${ordersData.length} orders, ${schedulePlansData.length} schedule plans, ${depositsData.length} deposits, ${settlementsData.length} settlements, ${supplierTransactionsData.length} supplier transactions, ${inventoryReservationsData.length} inventory reservations, ${surveyReportsData.length} survey reports`);


  // 9. INVENTORY (Data đã được chuẩn bị trước vòng lặp orders để dùng cho reservation)
  // ==========================================================================
  await prisma.inventory.createMany({
    data: inventoryData,
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
