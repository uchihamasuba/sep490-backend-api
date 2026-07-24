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
} from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

// "Hôm nay" của kịch bản seed — mọi ngày tháng tương đối (sự kiện đã xong / sắp diễn ra) tính từ mốc này.
const TODAY = new Date('2026-07-24T08:00:00Z');

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
  'inventory',
  'settlements',
  'deposits',
  'supplier_transaction_items',
  'supplier_transactions',
  'change_request_items',
  'change_requests',
  'survey_reports',
  'attendances',
  'schedule_plan_assignees',
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
  { username: 'admin2', fullName: 'Trần Thị Bích Ngọc', role: 'ADMIN', phone: '0901111002', email: 'admin2@bnwevents.vn' },
  { username: 'manager', fullName: 'Lê Hoàng Nam', role: 'MANAGER', jobTitle: 'Trưởng phòng Kinh doanh', phone: '0902222001', email: 'manager@bnwevents.vn' },
  { username: 'manager2', fullName: 'Phạm Thị Hồng Nhung', role: 'MANAGER', jobTitle: 'Trưởng phòng Vận hành', phone: '0902222002', email: 'manager2@bnwevents.vn' },
  { username: 'manager3', fullName: 'Đỗ Minh Tuấn', role: 'MANAGER', jobTitle: 'Quản lý Tài chính', phone: '0902222003', email: 'manager3@bnwevents.vn' },
  { username: 'leader', fullName: 'Vũ Đức Thắng', role: 'LEADER', jobTitle: 'Trưởng nhóm Kỹ thuật Âm thanh', phone: '0903333001', email: 'leader@bnwevents.vn' },
  { username: 'leader2', fullName: 'Hoàng Văn Long', role: 'LEADER', jobTitle: 'Trưởng nhóm Ánh sáng - Sân khấu', phone: '0903333002', email: 'leader2@bnwevents.vn' },
  { username: 'leader3', fullName: 'Ngô Thị Lan', role: 'LEADER', jobTitle: 'Trưởng nhóm Hậu cần', phone: '0903333003', email: 'leader3@bnwevents.vn' },
  { username: 'leader4', fullName: 'Bùi Quang Huy', role: 'LEADER', jobTitle: 'Trưởng nhóm Dựng sân khấu', phone: '0903333004', email: 'leader4@bnwevents.vn' },
  { username: 'tech', fullName: 'Đặng Văn Sơn', role: 'TECHNICAL', jobTitle: 'Kỹ thuật viên Âm thanh', phone: '0904444001', email: 'tech@bnwevents.vn' },
  { username: 'tech2', fullName: 'Phan Thị Mai', role: 'TECHNICAL', jobTitle: 'Kỹ thuật viên Ánh sáng', phone: '0904444002', email: 'tech2@bnwevents.vn' },
  { username: 'tech3', fullName: 'Trịnh Văn Hùng', role: 'TECHNICAL', jobTitle: 'Kỹ thuật viên Dựng sân khấu', phone: '0904444003', email: 'tech3@bnwevents.vn' },
  { username: 'tech4', fullName: 'Lý Thị Thu', role: 'TECHNICAL', jobTitle: 'Kỹ thuật viên Màn hình LED', phone: '0904444004', email: 'tech4@bnwevents.vn' },
  { username: 'tech5', fullName: 'Đinh Văn Phúc', role: 'TECHNICAL', jobTitle: 'Kỹ thuật viên Quay chụp', phone: '0904444005', email: 'tech5@bnwevents.vn' },
  { username: 'tech6', fullName: 'Dương Thị Nga', role: 'TECHNICAL', jobTitle: 'Kỹ thuật viên Hậu cần', phone: '0904444006', email: 'tech6@bnwevents.vn' },
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
  { code: 'CAT-AUDIO', name: 'Âm thanh' },
  { code: 'CAT-LIGHT', name: 'Ánh sáng' },
  { code: 'CAT-LED', name: 'Màn hình LED' },
  { code: 'CAT-STAGE', name: 'Sân khấu' },
  { code: 'CAT-FURN', name: 'Bàn ghế' },
  { code: 'CAT-DECOR', name: 'Trang trí' },
  { code: 'CAT-MEDIA', name: 'Trình chiếu & Ghi hình' },
];

interface TypeSeed {
  code: string;
  name: string;
  categoryCode: string;
}

const TYPES_SEED: TypeSeed[] = [
  { code: 'TYPE-SPK', name: 'Loa', categoryCode: 'CAT-AUDIO' },
  { code: 'TYPE-MIC', name: 'Micro', categoryCode: 'CAT-AUDIO' },
  { code: 'TYPE-AMP', name: 'Amply & Vang số', categoryCode: 'CAT-AUDIO' },
  { code: 'TYPE-MIX', name: 'Bàn trộn âm thanh', categoryCode: 'CAT-AUDIO' },
  { code: 'TYPE-AUDACC', name: 'Phụ kiện âm thanh', categoryCode: 'CAT-AUDIO' },
  { code: 'TYPE-AUDPKG', name: 'Gói âm thanh trọn gói', categoryCode: 'CAT-AUDIO' },
  { code: 'TYPE-PAR', name: 'Đèn Par LED', categoryCode: 'CAT-LIGHT' },
  { code: 'TYPE-BEAM', name: 'Đèn Beam', categoryCode: 'CAT-LIGHT' },
  { code: 'TYPE-MOVE', name: 'Đèn Moving Head', categoryCode: 'CAT-LIGHT' },
  { code: 'TYPE-STRLGT', name: 'Đèn trang trí dây', categoryCode: 'CAT-LIGHT' },
  { code: 'TYPE-LGTPKG', name: 'Gói ánh sáng trọn gói', categoryCode: 'CAT-LIGHT' },
  { code: 'TYPE-LEDOUT', name: 'Màn hình LED ngoài trời', categoryCode: 'CAT-LED' },
  { code: 'TYPE-LEDIN', name: 'Màn hình LED trong nhà', categoryCode: 'CAT-LED' },
  { code: 'TYPE-DISPLAY', name: 'Màn hình trình chiếu', categoryCode: 'CAT-LED' },
  { code: 'TYPE-FRAME', name: 'Khung sân khấu', categoryCode: 'CAT-STAGE' },
  { code: 'TYPE-CARPET', name: 'Thảm sân khấu', categoryCode: 'CAT-STAGE' },
  { code: 'TYPE-BACKDROP', name: 'Backdrop', categoryCode: 'CAT-STAGE' },
  { code: 'TYPE-TRUSS', name: 'Truss trang trí', categoryCode: 'CAT-STAGE' },
  { code: 'TYPE-RNDTBL', name: 'Bàn tròn', categoryCode: 'CAT-FURN' },
  { code: 'TYPE-RECTBL', name: 'Bàn chữ nhật', categoryCode: 'CAT-FURN' },
  { code: 'TYPE-CHAIR', name: 'Ghế sự kiện', categoryCode: 'CAT-FURN' },
  { code: 'TYPE-LINEN', name: 'Khăn trải bàn', categoryCode: 'CAT-FURN' },
  { code: 'TYPE-GATE', name: 'Cổng hoa', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-FLOWER', name: 'Hoa trang trí', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-REDCARPET', name: 'Thảm đỏ', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-PODIUM', name: 'Bục phát biểu', categoryCode: 'CAT-DECOR' },
  { code: 'TYPE-PROJ', name: 'Máy chiếu', categoryCode: 'CAT-MEDIA' },
  { code: 'TYPE-CAM', name: 'Máy quay & Flycam', categoryCode: 'CAT-MEDIA' },
  { code: 'TYPE-GEN', name: 'Máy phát điện', categoryCode: 'CAT-MEDIA' },
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
  // Loa
  { code: 'SPK-JBL715', name: 'Loa JBL EON715 (500W)', typeCode: 'TYPE-SPK', unit: 'Cái', rentalPrice: 500000, purchasePrice: 15000000 },
  { code: 'SPK-RCFLA', name: 'Loa Line Array RCF TTL55A', typeCode: 'TYPE-SPK', unit: 'Cái', rentalPrice: 1200000, purchasePrice: 45000000 },
  { code: 'SPK-SUB18', name: 'Loa Sub JBL SRX828S 18inch', typeCode: 'TYPE-SPK', unit: 'Cái', rentalPrice: 700000, purchasePrice: 22000000 },
  { code: 'SPK-BOSEL1', name: 'Loa kéo di động Bose L1 Pro', typeCode: 'TYPE-SPK', unit: 'Cái', rentalPrice: 400000, purchasePrice: 12000000 },
  // Micro
  { code: 'MIC-SM58', name: 'Micro không dây Shure SM58', typeCode: 'TYPE-MIC', unit: 'Cái', rentalPrice: 150000, purchasePrice: 3500000 },
  { code: 'MIC-EW112', name: 'Micro cài áo Sennheiser EW112P', typeCode: 'TYPE-MIC', unit: 'Cái', rentalPrice: 200000, purchasePrice: 5000000 },
  { code: 'MIC-MX418', name: 'Micro cổ ngỗng hội nghị Shure MX418', typeCode: 'TYPE-MIC', unit: 'Cái', rentalPrice: 180000, purchasePrice: 4000000 },
  // Amply & vang số
  { code: 'AMP-CROWN', name: 'Amply công suất Crown XLS2502', typeCode: 'TYPE-AMP', unit: 'Cái', rentalPrice: 300000, purchasePrice: 9000000 },
  { code: 'AMP-DBX', name: 'Vang số DBX DriveRack PA2', typeCode: 'TYPE-AMP', unit: 'Cái', rentalPrice: 250000, purchasePrice: 7500000 },
  // Bàn mixer
  { code: 'MIX-YAMAHA', name: 'Bàn mixer Yamaha MG16XU', typeCode: 'TYPE-MIX', unit: 'Cái', rentalPrice: 350000, purchasePrice: 11000000 },
  { code: 'MIX-SOUNDCRAFT', name: 'Bàn mixer Soundcraft Signature 12', typeCode: 'TYPE-MIX', unit: 'Cái', rentalPrice: 320000, purchasePrice: 10000000 },
  // Phụ kiện âm thanh
  { code: 'ACC-CABLE', name: 'Dây cáp tín hiệu Canon (bộ 20m)', typeCode: 'TYPE-AUDACC', unit: 'Bộ', rentalPrice: 30000, purchasePrice: 500000 },
  { code: 'ACC-SPKWIRE', name: 'Dây loa (cuộn 50m)', typeCode: 'TYPE-AUDACC', unit: 'Cuộn', rentalPrice: 50000, purchasePrice: 800000 },
  // Gói âm thanh trọn gói (combo BOM)
  { code: 'PKG-AUDHALL', name: 'Gói Âm Thanh Hội Trường (100-300 khách)', typeCode: 'TYPE-AUDPKG', unit: 'Gói', rentalPrice: 8000000, purchasePrice: 0 },
  { code: 'PKG-AUDOUT', name: 'Gói Âm Thanh Ngoài Trời (500-1000 khách)', typeCode: 'TYPE-AUDPKG', unit: 'Gói', rentalPrice: 18000000, purchasePrice: 0 },
  // Đèn Par LED
  { code: 'PAR-54X3', name: 'Đèn Par LED 54x3W', typeCode: 'TYPE-PAR', unit: 'Cái', rentalPrice: 120000, purchasePrice: 2500000 },
  { code: 'PAR-COB200', name: 'Đèn Par LED COB RGBW 200W', typeCode: 'TYPE-PAR', unit: 'Cái', rentalPrice: 180000, purchasePrice: 4000000 },
  // Đèn Beam
  { code: 'BEAM-7R', name: 'Đèn Beam 230 7R', typeCode: 'TYPE-BEAM', unit: 'Cái', rentalPrice: 350000, purchasePrice: 9500000 },
  { code: 'BEAM-5R', name: 'Đèn Beam Sharpy 5R', typeCode: 'TYPE-BEAM', unit: 'Cái', rentalPrice: 300000, purchasePrice: 8000000 },
  // Moving Head
  { code: 'MOVE-WASH', name: 'Đèn Moving Head Wash 19x15W', typeCode: 'TYPE-MOVE', unit: 'Cái', rentalPrice: 400000, purchasePrice: 11000000 },
  { code: 'MOVE-SPOT', name: 'Đèn Moving Head Spot 230W', typeCode: 'TYPE-MOVE', unit: 'Cái', rentalPrice: 380000, purchasePrice: 10500000 },
  // Đèn trang trí dây
  { code: 'STR-LED10M', name: 'Đèn dây LED trang trí (cuộn 10m)', typeCode: 'TYPE-STRLGT', unit: 'Cuộn', rentalPrice: 60000, purchasePrice: 400000 },
  { code: 'STR-BLINK', name: 'Đèn nháy trang trí ngoài trời (bộ)', typeCode: 'TYPE-STRLGT', unit: 'Bộ', rentalPrice: 80000, purchasePrice: 600000 },
  // Gói ánh sáng trọn gói (combo BOM)
  { code: 'PKG-LIGHTSTD', name: 'Gói Ánh Sáng Sân Khấu Tiêu Chuẩn', typeCode: 'TYPE-LGTPKG', unit: 'Gói', rentalPrice: 10000000, purchasePrice: 0 },
  // Màn hình LED ngoài trời
  { code: 'LED-OUTP3', name: 'Màn hình LED Outdoor P3 (module 500x500)', typeCode: 'TYPE-LEDOUT', unit: 'M2', rentalPrice: 1500000, purchasePrice: 12000000 },
  { code: 'LED-OUTP4', name: 'Màn hình LED Outdoor P4 (module 500x500)', typeCode: 'TYPE-LEDOUT', unit: 'M2', rentalPrice: 1200000, purchasePrice: 9500000 },
  // Màn hình LED trong nhà
  { code: 'LED-INP25', name: 'Màn hình LED Indoor P2.5 (module 500x500)', typeCode: 'TYPE-LEDIN', unit: 'M2', rentalPrice: 1800000, purchasePrice: 15000000 },
  // Màn hình trình chiếu
  { code: 'DISP-TV65', name: 'TV màn hình Samsung 65 inch', typeCode: 'TYPE-DISPLAY', unit: 'Cái', rentalPrice: 600000, purchasePrice: 18000000 },
  { code: 'DISP-SCREEN', name: 'Màn chiếu Projector Screen 3x4m', typeCode: 'TYPE-DISPLAY', unit: 'Cái', rentalPrice: 300000, purchasePrice: 6000000 },
  // Khung sân khấu
  { code: 'FRM-6X4', name: 'Khung sân khấu lắp ghép 6x4m', typeCode: 'TYPE-FRAME', unit: 'Bộ', rentalPrice: 3500000, purchasePrice: 40000000 },
  { code: 'FRM-4X3', name: 'Khung sân khấu di động 4x3m', typeCode: 'TYPE-FRAME', unit: 'Bộ', rentalPrice: 2500000, purchasePrice: 28000000 },
  // Thảm sân khấu
  { code: 'CAR-RED', name: 'Thảm sân khấu màu đỏ (khổ 2m)', typeCode: 'TYPE-CARPET', unit: 'M2', rentalPrice: 25000, purchasePrice: 200000, bulk: true },
  { code: 'CAR-BLUE', name: 'Thảm sân khấu màu xanh (khổ 2m)', typeCode: 'TYPE-CARPET', unit: 'M2', rentalPrice: 25000, purchasePrice: 200000, bulk: true },
  // Backdrop
  { code: 'BACK-UFRAME', name: 'Backdrop khung chữ U 3x4m', typeCode: 'TYPE-BACKDROP', unit: 'Bộ', rentalPrice: 800000, purchasePrice: 5000000 },
  { code: 'BACK-HIFLEX', name: 'Backdrop in bạt Hiflex (theo m2)', typeCode: 'TYPE-BACKDROP', unit: 'M2', rentalPrice: 150000, purchasePrice: 400000 },
  // Truss
  { code: 'TRS-SQ290', name: 'Truss vuông 290 (cây 2m)', typeCode: 'TYPE-TRUSS', unit: 'Cây', rentalPrice: 200000, purchasePrice: 3000000 },
  { code: 'TRS-TRI200', name: 'Truss tam giác 200 (cây 2m)', typeCode: 'TYPE-TRUSS', unit: 'Cây', rentalPrice: 180000, purchasePrice: 2700000 },
  // Bàn tròn
  { code: 'TBL-RND15', name: 'Bàn tiệc tròn 1m5', typeCode: 'TYPE-RNDTBL', unit: 'Cái', rentalPrice: 100000, purchasePrice: 1800000, bulk: true },
  { code: 'TBL-RND18', name: 'Bàn tiệc tròn 1m8', typeCode: 'TYPE-RNDTBL', unit: 'Cái', rentalPrice: 120000, purchasePrice: 2200000, bulk: true },
  // Bàn chữ nhật
  { code: 'TBL-RECT12', name: 'Bàn hội nghị chữ nhật 1m2', typeCode: 'TYPE-RECTBL', unit: 'Cái', rentalPrice: 90000, purchasePrice: 1500000, bulk: true },
  { code: 'TBL-RECT18', name: 'Bàn hội nghị chữ nhật 1m8', typeCode: 'TYPE-RECTBL', unit: 'Cái', rentalPrice: 110000, purchasePrice: 1900000, bulk: true },
  // Ghế
  { code: 'CHR-PLASTIC', name: 'Ghế nhựa Đài Loan', typeCode: 'TYPE-CHAIR', unit: 'Cái', rentalPrice: 15000, purchasePrice: 150000, bulk: true },
  { code: 'CHR-TIFFANY', name: 'Ghế tiffany mạ vàng', typeCode: 'TYPE-CHAIR', unit: 'Cái', rentalPrice: 35000, purchasePrice: 450000, bulk: true },
  { code: 'CHR-SOFA', name: 'Ghế sofa sự kiện', typeCode: 'TYPE-CHAIR', unit: 'Cái', rentalPrice: 80000, purchasePrice: 1500000, bulk: true },
  // Khăn trải bàn
  { code: 'LIN-WHITE', name: 'Khăn trải bàn trắng', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  { code: 'LIN-RED', name: 'Khăn trải bàn đỏ đô', typeCode: 'TYPE-LINEN', unit: 'Cái', rentalPrice: 20000, purchasePrice: 100000, bulk: true },
  // Cổng hoa
  { code: 'GATE-OPENING', name: 'Cổng hoa khai trương', typeCode: 'TYPE-GATE', unit: 'Bộ', rentalPrice: 1500000, purchasePrice: 8000000 },
  { code: 'GATE-WEDDING', name: 'Cổng hoa cưới', typeCode: 'TYPE-GATE', unit: 'Bộ', rentalPrice: 2000000, purchasePrice: 10000000 },
  // Hoa trang trí
  { code: 'FLW-VASE', name: 'Bình hoa lụa trang trí bàn', typeCode: 'TYPE-FLOWER', unit: 'Cái', rentalPrice: 80000, purchasePrice: 500000, bulk: true },
  { code: 'FLW-STAGE', name: 'Lẵng hoa trang trí sân khấu', typeCode: 'TYPE-FLOWER', unit: 'Cái', rentalPrice: 350000, purchasePrice: 1500000 },
  // Thảm đỏ
  { code: 'RCARPET-12', name: 'Thảm đỏ trải lối đi (khổ 1m2)', typeCode: 'TYPE-REDCARPET', unit: 'M2', rentalPrice: 30000, purchasePrice: 300000, bulk: true },
  // Bục phát biểu
  { code: 'PODIUM-WOOD', name: 'Bục phát biểu gỗ veneer', typeCode: 'TYPE-PODIUM', unit: 'Cái', rentalPrice: 250000, purchasePrice: 4000000 },
  // Máy chiếu
  { code: 'PROJ-PANA6000', name: 'Máy chiếu Panasonic 6000 Lumens', typeCode: 'TYPE-PROJ', unit: 'Cái', rentalPrice: 800000, purchasePrice: 25000000 },
  // Máy quay & Flycam
  { code: 'CAM-SONYFX6', name: 'Máy quay sự kiện Sony FX6', typeCode: 'TYPE-CAM', unit: 'Cái', rentalPrice: 2500000, purchasePrice: 150000000 },
  { code: 'CAM-DJIMAVIC3', name: 'Flycam DJI Mavic 3', typeCode: 'TYPE-CAM', unit: 'Cái', rentalPrice: 3000000, purchasePrice: 45000000 },
  // Máy phát điện
  { code: 'GEN-10KVA', name: 'Máy phát điện Cummins 10KVA', typeCode: 'TYPE-GEN', unit: 'Cái', rentalPrice: 1500000, purchasePrice: 60000000 },
  { code: 'GEN-30KVA', name: 'Máy phát điện Cummins 30KVA', typeCode: 'TYPE-GEN', unit: 'Cái', rentalPrice: 3000000, purchasePrice: 150000000 },
];

interface ComponentSeed {
  parentCode: string;
  childCode: string;
  quantity: number;
}

// Cấu trúc BOM cho các item dạng "Gói trọn gói" — parent là item combo, child là thiết bị lẻ cấu thành.
const ITEM_COMPONENTS_SEED: ComponentSeed[] = [
  { parentCode: 'PKG-AUDHALL', childCode: 'SPK-JBL715', quantity: 4 },
  { parentCode: 'PKG-AUDHALL', childCode: 'AMP-CROWN', quantity: 1 },
  { parentCode: 'PKG-AUDHALL', childCode: 'MIX-YAMAHA', quantity: 1 },
  { parentCode: 'PKG-AUDHALL', childCode: 'MIC-SM58', quantity: 2 },
  { parentCode: 'PKG-AUDHALL', childCode: 'ACC-CABLE', quantity: 2 },
  { parentCode: 'PKG-AUDOUT', childCode: 'SPK-RCFLA', quantity: 2 },
  { parentCode: 'PKG-AUDOUT', childCode: 'SPK-SUB18', quantity: 2 },
  { parentCode: 'PKG-AUDOUT', childCode: 'AMP-DBX', quantity: 1 },
  { parentCode: 'PKG-AUDOUT', childCode: 'MIX-SOUNDCRAFT', quantity: 1 },
  { parentCode: 'PKG-AUDOUT', childCode: 'MIC-SM58', quantity: 4 },
  { parentCode: 'PKG-AUDOUT', childCode: 'ACC-CABLE', quantity: 4 },
  { parentCode: 'PKG-LIGHTSTD', childCode: 'PAR-54X3', quantity: 8 },
  { parentCode: 'PKG-LIGHTSTD', childCode: 'MOVE-WASH', quantity: 4 },
  { parentCode: 'PKG-LIGHTSTD', childCode: 'BEAM-7R', quantity: 2 },
  { parentCode: 'PKG-LIGHTSTD', childCode: 'TRS-SQ290', quantity: 4 },
];

interface PartySeed {
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  status?: ActiveStatus;
}

const CUSTOMERS_SEED: PartySeed[] = [
  { code: 'CUS-001', name: 'Công ty TNHH Sự kiện Việt Phát', phone: '0911111001', email: 'contact@vietphat.vn', address: '12 Nguyễn Huệ, Q.1, TP.HCM' },
  { code: 'CUS-002', name: 'Công ty CP Truyền thông ABC Media', phone: '0911111002', email: 'contact@abcmedia.vn', address: '45 Lê Lợi, Q.1, TP.HCM' },
  { code: 'CUS-003', name: 'Tập đoàn Giáo dục EduGroup', phone: '0911111003', email: 'info@edugroup.edu.vn', address: '88 Trần Duy Hưng, Cầu Giấy, Hà Nội' },
  { code: 'CUS-004', name: 'Công ty TNHH Xây dựng Hòa Bình', phone: '0911111004', email: 'hoabinh.jsc@gmail.com', address: '234 Nguyễn Trãi, Thanh Xuân, Hà Nội' },
  { code: 'CUS-005', name: 'Ngân hàng TMCP Phương Đông - CN Q.3', phone: '0911111005', email: 'pgd.q3@ocb.com.vn', address: '67 Cách Mạng Tháng 8, Q.3, TP.HCM' },
  { code: 'CUS-006', name: 'Công ty CP Bất động sản Sun Land', phone: '0911111006', email: 'sunland@realestate.vn', address: '156 Điện Biên Phủ, Bình Thạnh, TP.HCM' },
  { code: 'CUS-007', name: 'Trường Đại học Công nghệ HUTECH', phone: '0911111007', email: 'events@hutech.edu.vn', address: '475A Điện Biên Phủ, Bình Thạnh, TP.HCM' },
  { code: 'CUS-008', name: 'Công ty TNHH Thương mại Minh Phát', phone: '0911111008', email: 'minhphat.trading@gmail.com', address: '23 Lý Thường Kiệt, Hải Châu, Đà Nẵng' },
  { code: 'CUS-009', name: 'Công ty CP Dược phẩm Sao Việt', phone: '0911111009', email: 'saoviet.pharma@gmail.com', address: '89 Nguyễn Văn Linh, Q.7, TP.HCM' },
  { code: 'CUS-010', name: 'Khách sạn Rex Sài Gòn', phone: '0911111010', email: 'events@rexhotel.vn', address: '141 Nguyễn Huệ, Q.1, TP.HCM' },
  { code: 'CUS-011', name: 'Anh Nguyễn Văn Bảo', phone: '0912222001', email: 'baonguyen88@gmail.com', address: '34 Phan Xích Long, Phú Nhuận, TP.HCM' },
  { code: 'CUS-012', name: 'Chị Trần Thị Cẩm Tú', phone: '0912222002', email: 'camtu.tran@gmail.com', address: '12 Hoàng Diệu, Hải Châu, Đà Nẵng' },
  { code: 'CUS-013', name: 'Anh Lê Quốc Việt', phone: '0912222003', email: 'levietq@gmail.com', address: '56 Kim Mã, Ba Đình, Hà Nội' },
  { code: 'CUS-014', name: 'Chị Phạm Thu Hà', phone: '0912222004', email: 'thuha.pham@gmail.com', address: '78 Trần Phú, Nha Trang' },
  { code: 'CUS-015', name: 'Anh Hoàng Anh Dũng', phone: '0912222005', email: 'dunghoang@gmail.com', address: '90 Nguyễn Thị Minh Khai, Q.3, TP.HCM' },
  { code: 'CUS-016', name: 'Chị Đỗ Ngọc Diệp', phone: '0912222006', email: 'ngocdiep.do@gmail.com', address: '15 Bà Triệu, Hai Bà Trưng, Hà Nội' },
  { code: 'CUS-017', name: 'Anh Vũ Thành Trung', phone: '0912222007', email: 'trungvu@gmail.com', address: '22 Nguyễn Văn Cừ, Long Biên, Hà Nội', status: 'INACTIVE' },
  { code: 'CUS-018', name: 'Chị Ngô Bích Ngọc', phone: '0912222008', email: 'ngocngo.bich@gmail.com', address: '40 Trường Sa, Phú Nhuận, TP.HCM', status: 'INACTIVE' },
];

interface SupplierSeed extends PartySeed {
  serviceType: string;
  contactPerson: string;
  rating: number;
}

const SUPPLIERS_SEED: SupplierSeed[] = [
  { code: 'SUP-001', name: 'Công ty TNHH Thiết bị Sân khấu Ánh Dương', serviceType: 'Cho thuê sân khấu, truss, backdrop', contactPerson: 'Nguyễn Văn Hải', phone: '0933333001', email: 'contact@anhduongstage.vn', address: '12 Quang Trung, Hà Đông, Hà Nội', rating: 4.5 },
  { code: 'SUP-002', name: 'Công ty CP Cho thuê Bàn Ghế Thành Công', serviceType: 'Cho thuê bàn ghế sự kiện', contactPerson: 'Trần Văn Đạt', phone: '0933333002', email: 'thanhcongfurniture@gmail.com', address: '34 Lê Văn Việt, Q.9, TP.HCM', rating: 4.2 },
  { code: 'SUP-003', name: 'Công ty TNHH Kỹ thuật Điện Toàn Phát', serviceType: 'Cho thuê máy phát điện', contactPerson: 'Lê Thị Hạnh', phone: '0933333003', email: 'toanphat.genset@gmail.com', address: '56 Phạm Văn Đồng, Thủ Đức, TP.HCM', rating: 4.7 },
  { code: 'SUP-004', name: 'Công ty CP Hoa Tươi Sự Kiện Lan Anh', serviceType: 'Trang trí hoa tươi sự kiện', contactPerson: 'Nguyễn Thị Lan Anh', phone: '0933333004', email: 'lananhflower@gmail.com', address: '78 Hoàng Hoa Thám, Ba Đình, Hà Nội', rating: 4.9 },
  { code: 'SUP-005', name: 'Công ty TNHH Truss & Rigging Việt', serviceType: 'Cho thuê truss, giàn treo kỹ thuật', contactPerson: 'Phạm Văn Sơn', phone: '0933333005', email: 'vietrigging@gmail.com', address: '90 Nguyễn Xí, Bình Thạnh, TP.HCM', rating: 4.3 },
  { code: 'SUP-006', name: 'Studio Ánh Sáng Sự Kiện Nam Việt', serviceType: 'Quay phim, chụp ảnh, flycam sự kiện', contactPerson: 'Đặng Thị Thu', phone: '0933333006', email: 'namvietstudio@gmail.com', address: '23 Trần Não, Q.2, TP.HCM', rating: 4.6 },
  { code: 'SUP-007', name: 'Công ty CP Vận Tải Sự Kiện Nhanh', serviceType: 'Vận chuyển thiết bị sự kiện', contactPerson: 'Bùi Văn Khoa', phone: '0933333007', email: 'nhanhtransport@gmail.com', address: '45 Giải Phóng, Hoàng Mai, Hà Nội', rating: 4.0 },
];

const WORK_TASKS_SEED = [
  { code: 'SURVEY', name: 'Khảo sát hiện trường' },
  { code: 'SETUP', name: 'Lắp đặt thiết bị' },
  { code: 'OPERATE', name: 'Vận hành sự kiện' },
  { code: 'TEARDOWN', name: 'Tháo dỡ thiết bị' },
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
];

const COMPLEX_EVENT_TYPES = new Set(['Hội nghị doanh nghiệp', 'Hội thảo chuyên đề', 'Gala Dinner', 'Lễ ra mắt sản phẩm']);

const VENUES = [
  'Trung tâm Hội nghị Quốc gia, Hà Nội',
  'Gem Center, Q.1, TP.HCM',
  'White Palace, Phú Nhuận, TP.HCM',
  'Ana Mandara Resort, Nha Trang',
  'Khách sạn Rex Sài Gòn, Q.1, TP.HCM',
  'Furama Resort, Đà Nẵng',
  'Trung tâm Tiệc cưới Adora, Tân Bình, TP.HCM',
  'Sân vận động Mỹ Đình, Hà Nội',
  'Khuôn viên Trường Đại học HUTECH, Bình Thạnh, TP.HCM',
  'Nhà hàng Tiệc cưới Riverside Palace, Q.7, TP.HCM',
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
    const isOperational = u.role === 'LEADER' || u.role === 'TECHNICAL';
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
  const leaders = allUsers.filter((u) => u.role === 'LEADER');
  const technicals = allUsers.filter((u) => u.role === 'TECHNICAL');
  const operationalPool = [...leaders, ...technicals];
  console.log(`  - ${allUsers.length} users (admin=${admins.length}, manager=${managers.length}, leader=${leaders.length}, tech=${technicals.length})`);

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
  const depositPolicy = policies.find((p) => p.policyCode === 'DEP-30')!;
  const compensationPolicy = policies.find((p) => p.policyCode === 'COM-100')!;
  const feePolicy = policies.find((p) => p.policyCode === 'FEE-OT')!;

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
      status: c.status ?? 'ACTIVE',
    })),
  });
  const customerRows = await prisma.customer.findMany();
  const customers: CreatedParty[] = customerRows.map((c) => ({ id: c.customerId, code: c.customerCode, name: c.customerName }));

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
  const suppliers: CreatedParty[] = supplierRows.map((s) => ({ id: s.supplierId, code: s.supplierCode, name: s.supplierName }));
  console.log(`  - ${customers.length} customers, ${suppliers.length} suppliers`);

  // ==========================================================================
  // 5. EVIDENCE POOL (dùng chung cho schedule/attendance/survey/deposit/settlement)
  // ==========================================================================
  const evidenceIds: string[] = Array.from({ length: 15 }, () => genId());
  await prisma.evidence.createMany({
    data: evidenceIds.map((id, i) => ({
      evidenceId: id,
      fileUrl: `https://storage.bnwevents.vn/evidences/${id}.jpg`,
      description: EVIDENCE_DESCRIPTIONS[i % EVIDENCE_DESCRIPTIONS.length],
      uploadedBy: randomChoice(operationalPool).userId,
    })),
  });
  const randomEvidence = (chance: number): string | undefined => (Math.random() < chance ? randomChoice(evidenceIds) : undefined);

  // ==========================================================================
  // 6. QUOTATIONS (28) — DRAFT / APPROVED / REJECTED
  // ==========================================================================
  const quotationStatuses: QuotationStatus[] = shuffle([
    ...Array(14).fill('APPROVED'),
    ...Array(8).fill('DRAFT'),
    ...Array(6).fill('REJECTED'),
  ]);

  interface ApprovedQuotation {
    quotationId: string;
    customerId: string;
    items: OrderItemPick[];
    totalAmount: number;
  }
  const approvedQuotations: ApprovedQuotation[] = [];

  for (let i = 0; i < quotationStatuses.length; i++) {
    const status = quotationStatuses[i];
    const customer = randomChoice(customers);
    const creator = randomChoice(managers);
    const chosenItems = sample(items, randomInt(2, 5));

    const lines = chosenItems.map((it) => {
      const quantity = it.bulk ? randomInt(20, 150) : randomInt(1, 10);
      const price = it.rentalPrice;
      const discount = Math.random() < 0.3 ? round2(quantity * price * 0.05) : 0;
      const lineTotal = round2(quantity * price - discount);
      return { itemId: it.itemId, itemName: it.name, quantity, price, discount, lineTotal };
    });

    const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.price, 0));
    const discountTotal = round2(lines.reduce((s, l) => s + l.discount, 0));
    const totalAmount = round2(subtotal - discountTotal);
    const quotationId = genId();

    await prisma.quotation.create({
      data: {
        quotationId,
        quotationCode: `QUO-${pad(i + 1, 3)}`,
        customerId: customer.id,
        version: 'v1',
        subtotal,
        discountTotal,
        totalAmount,
        status,
        notes: `Báo giá dịch vụ tổ chức sự kiện cho ${customer.name}.`,
        createdBy: creator.userId,
        items: {
          create: lines.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            quantity: l.quantity,
            price: l.price,
            discount: l.discount,
            lineTotal: l.lineTotal,
          })),
        },
      },
    });

    if (status === 'APPROVED') {
      approvedQuotations.push({
        quotationId,
        customerId: customer.id,
        items: lines.map((l) => ({ itemId: l.itemId, itemName: l.itemName, quantity: l.quantity, unitPrice: l.price, subtotal: round2(l.quantity * l.price) })),
        totalAmount,
      });
    }
  }
  console.log(`  - ${quotationStatuses.length} quotations (${approvedQuotations.length} approved)`);

  // ==========================================================================
  // 7. ORDERS — sinh từ Quotation APPROVED, trải đều 5 trạng thái
  // ==========================================================================
  const targetOrderStatuses: OrderStatus[] = shuffle(
    (['NEW', 'NEW', 'NEW', 'CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED', 'CANCELLED'] as OrderStatus[]).slice(0, approvedQuotations.length),
  );

  function eventDateForStatus(status: OrderStatus): Date {
    switch (status) {
      case 'COMPLETED':
        return addDays(TODAY, -randomInt(10, 90));
      case 'CANCELLED':
        return addDays(TODAY, randomInt(-60, 60));
      case 'IN_PROGRESS':
        return addDays(TODAY, randomInt(-2, 5));
      case 'CONFIRMED':
        return addDays(TODAY, randomInt(5, 45));
      case 'NEW':
      default:
        return addDays(TODAY, randomInt(10, 90));
    }
  }

  function paymentStatusForOrder(status: OrderStatus): PaymentStatus {
    switch (status) {
      case 'COMPLETED':
        return 'PAID';
      case 'IN_PROGRESS':
        return Math.random() < 0.7 ? 'DEPOSITED' : 'PAID';
      case 'CONFIRMED':
        return Math.random() < 0.6 ? 'DEPOSITED' : 'UNPAID';
      case 'CANCELLED':
        return Math.random() < 0.5 ? 'DEPOSITED' : 'UNPAID';
      case 'NEW':
      default:
        return 'UNPAID';
    }
  }

  const createdOrders: CreatedOrder[] = [];

  for (let i = 0; i < approvedQuotations.length; i++) {
    const q = approvedQuotations[i];
    const status = targetOrderStatuses[i];
    const eventType = randomChoice(EVENT_TYPES);
    const eventDate = eventDateForStatus(status);
    const guestCount = COMPLEX_EVENT_TYPES.has(eventType) ? randomInt(200, 800) : randomInt(30, 300);
    const creator = randomChoice(managers);
    const leader = randomChoice(leaders);
    const orderId = genId();
    const orderCode = `ORD-${pad(i + 1, 3)}`;
    const totalAmount = round2(q.items.reduce((s, it) => s + it.subtotal, 0));
    const isCompleted = status === 'COMPLETED';
    const isPickedUp = status === 'IN_PROGRESS' || status === 'COMPLETED';
    const closer = isCompleted ? randomChoice(managers) : null;
    const pickedUpByUser = isPickedUp ? leader : null;

    await prisma.order.create({
      data: {
        orderId,
        orderCode,
        customerId: q.customerId,
        quotationId: q.quotationId,
        policyId: depositPolicy.policyId,
        eventType,
        eventName: `${eventType} - ${orderCode}`,
        eventDate,
        location: randomChoice(VENUES),
        guestCount,
        totalAmount,
        paymentStatus: paymentStatusForOrder(status),
        orderStatus: status,
        cancelReason: status === 'CANCELLED' ? randomChoice(['Khách hàng đổi lịch tổ chức', 'Khách hàng huỷ do thay đổi ngân sách', 'Trùng lịch với nhà cung cấp địa điểm']) : null,
        notes: `Đơn hàng chuyển đổi từ báo giá đã duyệt.`,
        createdBy: creator.userId,
        closedAt: isCompleted ? addHours(eventDate, randomInt(6, 30)) : null,
        closedBy: closer ? closer.userId : null,
        pickedUpAt: isPickedUp ? addHours(eventDate, -randomInt(2, 10)) : null,
        pickedUpBy: pickedUpByUser ? pickedUpByUser.userId : null,
        orderItems: {
          create: q.items.map((it) => ({
            itemId: it.itemId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            subtotal: it.subtotal,
            source: 'INTERNAL',
            preparedQty: status === 'NEW' ? 0 : it.quantity,
          })),
        },
      },
    });

    createdOrders.push({
      orderId,
      orderCode,
      customerId: q.customerId,
      status,
      eventType,
      eventDate,
      totalAmount,
      items: q.items,
      leaderId: leader.userId,
      technicalIds: sample(technicals, randomInt(1, 3)).map((t) => t.userId),
    });
  }
  console.log(`  - ${createdOrders.length} orders`);

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

  interface PlanConfig {
    taskCode: string;
    offsetDays: number;
    hourOffset: number;
    durationHours: number;
    planStatus: ScheduleStatus;
  }

  function planConfigsForStatus(status: OrderStatus): PlanConfig[] {
    switch (status) {
      case 'CANCELLED':
        return [{ taskCode: 'SURVEY', offsetDays: -14, hourOffset: 9, durationHours: 2, planStatus: 'CANCELLED' }];
      case 'NEW':
        return [{ taskCode: 'SURVEY', offsetDays: -10, hourOffset: 9, durationHours: 2, planStatus: 'PENDING' }];
      case 'CONFIRMED':
        return [
          { taskCode: 'SURVEY', offsetDays: -14, hourOffset: 9, durationHours: 2, planStatus: 'COMPLETED' },
          { taskCode: 'SETUP', offsetDays: -1, hourOffset: 14, durationHours: 5, planStatus: 'CONFIRMED' },
        ];
      case 'IN_PROGRESS':
        return [
          { taskCode: 'SURVEY', offsetDays: -14, hourOffset: 9, durationHours: 2, planStatus: 'COMPLETED' },
          { taskCode: 'SETUP', offsetDays: -1, hourOffset: 14, durationHours: 5, planStatus: 'COMPLETED' },
          { taskCode: 'OPERATE', offsetDays: 0, hourOffset: 8, durationHours: 6, planStatus: 'IN_PROGRESS' },
        ];
      case 'COMPLETED':
      default:
        return [
          { taskCode: 'SURVEY', offsetDays: -14, hourOffset: 9, durationHours: 2, planStatus: 'COMPLETED' },
          { taskCode: 'SETUP', offsetDays: -1, hourOffset: 14, durationHours: 5, planStatus: 'COMPLETED' },
          { taskCode: 'OPERATE', offsetDays: 0, hourOffset: 8, durationHours: 6, planStatus: 'COMPLETED' },
          { taskCode: 'TEARDOWN', offsetDays: 0, hourOffset: 22, durationHours: 3, planStatus: 'COMPLETED' },
          { taskCode: 'COLLECT', offsetDays: 1, hourOffset: 9, durationHours: 2, planStatus: 'COMPLETED' },
        ];
    }
  }

  // Tổng hợp dữ liệu dùng cho các bước sau: Inventory, InventoryMovement, CollectedEquipmentReport.
  const reservedByItem = new Map<string, number>();
  const damagedByItem = new Map<string, number>();
  const inventoryMovements: {
    itemId: string;
    orderId: string | null;
    reportId: string | null;
    movementType: 'OUTBOUND' | 'INBOUND' | 'ADJUSTMENT';
    quantity: number;
    performedBy: string;
    notes: string;
  }[] = [];

  for (const order of createdOrders) {
    if (order.status === 'NEW' || order.status === 'CONFIRMED' || order.status === 'IN_PROGRESS') {
      for (const it of order.items) {
        reservedByItem.set(it.itemId, (reservedByItem.get(it.itemId) ?? 0) + it.quantity);
      }
    }

    // --- SchedulePlan + Assignees + Attendance ---
    const planConfigs = planConfigsForStatus(order.status);
    let surveyPlanId: string | null = null;
    let surveyPlanStatus: ScheduleStatus | null = null;

    for (let p = 0; p < planConfigs.length; p++) {
      const cfg = planConfigs[p];
      const startTime = addHours(addDays(order.eventDate, cfg.offsetDays), cfg.hourOffset - order.eventDate.getUTCHours());
      const endTime = addHours(startTime, cfg.durationHours);
      const planId = genId();
      const assigneeRows: { assigneeId: string; userId: string; role: 'LEAD' | 'TECHNICAL' }[] = [
        { assigneeId: genId(), userId: order.leaderId, role: 'LEAD' },
        ...order.technicalIds.map((tid) => ({ assigneeId: genId(), userId: tid, role: 'TECHNICAL' as const })),
      ];

      await prisma.schedulePlan.create({
        data: {
          planId,
          planCode: `PLN-${order.orderCode.replace('ORD-', '')}-${pad(p + 1, 2)}`,
          orderId: order.orderId,
          taskId: taskIdByCode.get(cfg.taskCode)!,
          startTime,
          endTime,
          location: randomChoice(VENUES),
          status: cfg.planStatus,
          evidenceId: cfg.planStatus === 'COMPLETED' ? randomEvidence(0.5) ?? null : null,
          createdBy: randomChoice(managers).userId,
          assignees: {
            create: assigneeRows.map((a) => ({
              assigneeId: a.assigneeId,
              userId: a.userId,
              role: a.role,
              attendance:
                cfg.planStatus === 'IN_PROGRESS' || cfg.planStatus === 'COMPLETED'
                  ? {
                      create: {
                        checkInAt: new Date(startTime.getTime() - randomInt(5, 20) * 60000),
                        checkInEvidenceId: randomEvidence(0.5) ?? null,
                        checkOutAt: cfg.planStatus === 'COMPLETED' ? endTime : null,
                      },
                    }
                  : undefined,
            })),
          },
        },
      });

      if (cfg.taskCode === 'SURVEY') {
        surveyPlanId = planId;
        surveyPlanStatus = cfg.planStatus;
      }
    }

    // --- SurveyReport cho các sự kiện phức tạp ---
    if (surveyPlanId && order.status !== 'CANCELLED' && COMPLEX_EVENT_TYPES.has(order.eventType)) {
      const surveyStatus: SurveyStatus = surveyPlanStatus === 'COMPLETED' ? 'CONFIRMED' : order.status === 'NEW' ? 'DRAFT' : 'SUBMITTED';
      await prisma.surveyReport.create({
        data: {
          surveyId: genId(),
          reportCode: `SUR-${order.orderCode.replace('ORD-', '')}`,
          orderId: order.orderId,
          planId: surveyPlanId,
          evidenceId: randomEvidence(0.7) ?? null,
          surveyDate: addDays(order.eventDate, -14),
          location: randomChoice(VENUES),
          area: randomInt(150, 600),
          length: randomInt(15, 40),
          width: randomInt(8, 20),
          entrance: 'Cửa chính rộng, xe tải nhỏ ra vào thuận tiện',
          siteConstraints: 'Trần nhà giới hạn độ cao lắp truss; cần bố trí thêm nguồn điện dự phòng',
          additionalRequests: 'Khách yêu cầu bổ sung màn hình LED phụ khu vực sảnh',
          proposedItems: order.items.map((it) => `${it.itemName} x${it.quantity}`).join(', '),
          notes: 'Đã khảo sát thực địa, chờ xác nhận phương án bố trí cuối cùng',
          status: surveyStatus,
          reportedBy: order.leaderId,
          confirmedBy: surveyStatus === 'CONFIRMED' ? randomChoice(managers).userId : null,
          confirmedAt: surveyStatus === 'CONFIRMED' ? addDays(order.eventDate, -13) : null,
        },
      });
    }

    // --- ChangeRequest (ngẫu nhiên ~35% cho CONFIRMED/IN_PROGRESS/COMPLETED) ---
    if (order.status !== 'NEW' && order.status !== 'CANCELLED' && Math.random() < 0.35) {
      const type: ChangeRequestType = randomChoice(['add', 'remove'] as ChangeRequestType[]);
      const crStatus: ChangeRequestStatus = order.status === 'CONFIRMED' ? 'pending' : 'approved';
      const targetItem = randomChoice(items);
      await prisma.changeRequest.create({
        data: {
          changeRequestId: genId(),
          orderId: order.orderId,
          type,
          status: crStatus,
          items: {
            create: [{ catalogItemId: targetItem.itemId, quantity: randomInt(1, 5), action: type === 'add' ? 'add' : 'remove' }],
          },
        },
      });
    }

    // --- SupplierTransaction (ngẫu nhiên ~40% cho CONFIRMED/IN_PROGRESS/COMPLETED) ---
    if (order.status !== 'NEW' && order.status !== 'CANCELLED' && Math.random() < 0.4) {
      const supplier = randomChoice(suppliers);
      const transactionType: SupplierTransactionType = Math.random() < 0.7 ? 'RENTAL' : 'PURCHASE';
      const useCustomItem = Math.random() < 0.4;
      const refItem = randomChoice(items);
      const qty = randomInt(1, 6);
      const unitCost = refItem.purchasePrice > 0 ? Math.round(refItem.rentalPrice * 1.2) : 500000;
      const subtotalCost = round2(qty * unitCost);
      const txStatus: SupplierTransactionStatus = order.status === 'CONFIRMED' ? 'APPROVED' : order.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'COMPLETED';
      const txPaymentStatus: PaymentStatus = txStatus === 'COMPLETED' ? 'PAID' : 'DEPOSITED';
      await prisma.supplierTransaction.create({
        data: {
          transactionId: genId(),
          transactionCode: `STX-${order.orderCode.replace('ORD-', '')}`,
          supplierId: supplier.id,
          orderId: order.orderId,
          transactionType,
          serviceTitle: `Thuê ngoài bổ sung cho ${order.eventType}`,
          estimatedCost: subtotalCost,
          depositAmount: round2(subtotalCost * 0.3),
          paymentStatus: txPaymentStatus,
          status: txStatus,
          items: {
            create: [
              {
                itemId: useCustomItem ? null : refItem.itemId,
                itemName: useCustomItem ? 'Dịch vụ thuê ngoài theo yêu cầu' : refItem.name,
                quantity: qty,
                unitCost,
                subtotal: subtotalCost,
                receivedQuantity: txStatus === 'COMPLETED' ? qty : 0,
              },
            ],
          },
        },
      });
    }

    // --- Deposit (CONFIRMED/IN_PROGRESS/COMPLETED bắt buộc; CANCELLED một phần) ---
    const needsDeposit = order.status === 'CONFIRMED' || order.status === 'IN_PROGRESS' || order.status === 'COMPLETED' || (order.status === 'CANCELLED' && Math.random() < 0.5);
    if (needsDeposit) {
      const depositAmount = round2(order.totalAmount * 0.3);
      let depositStatus: DepositStatus;
      if (order.status === 'CANCELLED') depositStatus = 'CANCELLED';
      else if (order.status === 'CONFIRMED') depositStatus = Math.random() < 0.7 ? 'SUCCESS' : 'PENDING';
      else depositStatus = 'SUCCESS';
      const paymentDate = depositStatus === 'SUCCESS' ? addDays(order.eventDate, -randomInt(5, 20)) : null;
      const requester = randomChoice(managers);
      await prisma.deposit.create({
        data: {
          depositId: genId(),
          depositCode: `DEP-${order.orderCode.replace('ORD-', '')}`,
          orderId: order.orderId,
          amount: depositAmount,
          dueDate: addDays(order.eventDate, -25),
          paymentDate,
          paymentMethod: paymentDate ? randomChoice(['Chuyển khoản ngân hàng', 'Ví MoMo', 'Tiền mặt']) : null,
          qrCodeUrl: paymentDate ? `https://payments.bnwevents.vn/qr/${genId()}.png` : null,
          status: depositStatus,
          evidenceId: depositStatus === 'SUCCESS' ? randomEvidence(0.7) ?? null : null,
          requestedBy: requester.userId,
          approvedBy: depositStatus === 'SUCCESS' ? randomChoice(managers).userId : null,
          approvedAt: paymentDate,
          notes: `Đặt cọc theo chính sách ${depositPolicy.policyName}.`,
        },
      });
    }

    // --- Kho vận: OUTBOUND lúc lắp đặt cho IN_PROGRESS/COMPLETED ---
    if (order.status === 'IN_PROGRESS' || order.status === 'COMPLETED') {
      for (const it of order.items) {
        inventoryMovements.push({
          itemId: it.itemId,
          orderId: order.orderId,
          reportId: null,
          movementType: 'OUTBOUND',
          quantity: it.quantity,
          performedBy: order.leaderId,
          notes: `Xuất kho lắp đặt cho sự kiện ${order.orderCode}`,
        });
      }
    }

    // --- CollectedEquipmentReport + INBOUND cho COMPLETED ---
    if (order.status === 'COMPLETED') {
      const reportItems = order.items.map((it) => {
        const damaged = Math.random() < 0.15 ? randomInt(1, 2) : 0;
        const lost = Math.random() < 0.05 ? 1 : 0;
        const good = Math.max(0, it.quantity - damaged - lost);
        return { itemId: it.itemId, itemName: it.itemName, good, damaged, lost };
      });
      const anyIssue = reportItems.some((r) => r.damaged > 0 || r.lost > 0);
      const reportId = genId();
      const reportStatus: CollectedEquipmentReportStatus = Math.random() < 0.85 ? 'CONFIRMED' : 'SUBMITTED';
      await prisma.collectedEquipmentReport.create({
        data: {
          reportId,
          orderId: order.orderId,
          reportType: 'INTERNAL',
          status: reportStatus,
          reportedBy: order.leaderId,
          confirmedBy: reportStatus === 'CONFIRMED' ? randomChoice(managers).userId : null,
          confirmedAt: reportStatus === 'CONFIRMED' ? addDays(order.eventDate, 2) : null,
          notes: anyIssue ? `Thu hồi thiết bị sau sự kiện ${order.orderCode} — ghi nhận một số thiết bị hư hỏng/thất lạc.` : `Thu hồi thiết bị sau sự kiện ${order.orderCode} — đầy đủ, không phát sinh hư hỏng.`,
          items: {
            create: reportItems.map((r) => ({
              cerItemId: genId(),
              itemId: r.itemId,
              goodQuantity: r.good,
              damagedQuantity: r.damaged,
              lostQuantity: r.lost,
            })),
          },
        },
      });

      for (const r of reportItems) {
        if (r.damaged > 0) {
          damagedByItem.set(r.itemId, (damagedByItem.get(r.itemId) ?? 0) + r.damaged);
        }
        const returnedQty = r.good + r.damaged;
        if (returnedQty > 0) {
          inventoryMovements.push({
            itemId: r.itemId,
            orderId: order.orderId,
            reportId,
            movementType: 'INBOUND',
            quantity: returnedQty,
            performedBy: order.leaderId,
            notes: `Nhập kho thu hồi sau sự kiện ${order.orderCode}`,
          });
        }
      }

      // --- Settlement (bắt buộc cho COMPLETED) ---
      const compensation = anyIssue
        ? round2(
            reportItems.reduce((s, r) => {
              const item = items.find((x) => x.itemId === r.itemId);
              const unitReplacementCost = item ? item.purchasePrice : 0;
              return s + (r.damaged + r.lost) * unitReplacementCost * (compensationPolicy.policyValue.toNumber() / 100);
            }, 0),
          )
        : 0;
      const additionalFee = Math.random() < 0.3 ? round2(feePolicy.policyValue.toNumber() * randomInt(1, 3)) : 0;
      const discount = Math.random() < 0.2 ? randomInt(1, 3) * 100000 : 0;
      const finalAmount = round2(order.totalAmount + additionalFee - discount + compensation);
      const requester = randomChoice(managers);
      const confirmer = randomChoice(managers);
      await prisma.settlement.create({
        data: {
          settlementId: genId(),
          orderId: order.orderId,
          additionalFee,
          compensation,
          discount,
          finalAmount,
          paymentMethod: 'Chuyển khoản ngân hàng',
          qrCodeUrl: `https://payments.bnwevents.vn/qr/${genId()}.png`,
          paidAt: addDays(order.eventDate, 3),
          evidenceId: randomEvidence(0.7) ?? null,
          status: 'CONFIRMED',
          requestedBy: requester.userId,
          requestedAt: addDays(order.eventDate, 1),
          confirmedBy: confirmer.userId,
          confirmedAt: addDays(order.eventDate, 3),
          notes: anyIssue ? `Có phát sinh đền bù theo chính sách ${compensationPolicy.policyName}.` : 'Quyết toán không phát sinh thêm chi phí.',
        },
      });
    } else if (order.status === 'IN_PROGRESS') {
      // --- Settlement nháp (bắt buộc cho IN_PROGRESS, chưa quyết toán cuối) ---
      await prisma.settlement.create({
        data: {
          settlementId: genId(),
          orderId: order.orderId,
          additionalFee: 0,
          compensation: 0,
          discount: 0,
          finalAmount: order.totalAmount,
          status: Math.random() < 0.5 ? 'DRAFT' : 'AGREED',
          notes: 'Sự kiện đang diễn ra, chưa quyết toán cuối cùng.',
        },
      });
    }
  }
  console.log(`  - Đã sinh Schedule/Survey/ChangeRequest/SupplierTransaction/Deposit/Settlement/CollectedEquipmentReport cho ${createdOrders.length} orders`);

  // ==========================================================================
  // 9. INVENTORY — 1 dòng cho TOÀN BỘ items (available + reserved + damaged = total)
  // ==========================================================================
  await prisma.inventory.createMany({
    data: items.map((it) => {
      const reserved = reservedByItem.get(it.itemId) ?? 0;
      const damaged = damagedByItem.get(it.itemId) ?? 0;
      const available = it.bulk ? randomInt(20, 80) : randomInt(5, 30);
      return {
        inventoryId: genId(),
        itemId: it.itemId,
        quantityTotal: reserved + damaged + available,
        quantityDamaged: damaged,
        quantityReserved: reserved,
        quantityAvailable: available,
      };
    }),
  });

  // ==========================================================================
  // 10. INVENTORY MOVEMENTS — OUTBOUND/INBOUND thu thập ở bước 8, cộng thêm vài ADJUSTMENT
  // ==========================================================================
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

  // ==========================================================================
  // 11. NOTIFICATIONS
  // ==========================================================================
  interface NotificationSeed {
    userId: string;
    title: string;
    content: string;
    notificationType: 'SYSTEM' | 'ORDER' | 'TASK';
    refType?: string;
    refId?: string;
  }

  const notificationTargets = sample(createdOrders, Math.min(10, createdOrders.length));
  const notificationsData: NotificationSeed[] = notificationTargets.flatMap((order) => [
    { userId: randomChoice(managers).userId, title: 'Cập nhật đơn hàng', content: `Đơn hàng ${order.orderCode} vừa được cập nhật trạng thái ${order.status}.`, notificationType: 'ORDER', refType: 'ORDER', refId: order.orderId },
    { userId: order.leaderId, title: 'Phân công công việc', content: `Bạn được phân công phụ trách sự kiện ${order.orderCode}.`, notificationType: 'TASK', refType: 'ORDER', refId: order.orderId },
  ]);
  notificationsData.push({
    userId: randomChoice(managers).userId,
    title: 'Thông báo hệ thống',
    content: 'Dữ liệu mẫu đã được khởi tạo thành công.',
    notificationType: 'SYSTEM',
  });
  await prisma.notification.createMany({
    data: notificationsData.map((n) => ({
      userId: n.userId,
      title: n.title,
      content: n.content,
      notificationType: n.notificationType,
      refType: n.refType,
      refId: n.refId,
    })),
  });
  console.log(`  - ${notificationsData.length} notifications`);

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
