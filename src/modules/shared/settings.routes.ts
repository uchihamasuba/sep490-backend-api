import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { settingsController } from './settings.controller';
import { listTransactionsQuerySchema, updateBankAccountBodySchema } from './settings.validators';

// Mounted at /api/v1/settings
const router = Router();

router.use(requireAuth);

// GET bank-account: MỌI role đăng nhập đọc được — Manager/Admin (web deposit/settlement) VÀ Leader Staff
// (mobile hiện QR tại hiện trường) đều cần lấy tài khoản để dựng mã QR. Thông tin TK vốn công khai.
router.get('/bank-account', asyncHandler(settingsController.getBankAccount));

// GET banks: danh sách ngân hàng (proxy banks.json) để Admin CHỌN khi cấu hình — dữ liệu công khai,
// mọi role đăng nhập đọc được.
router.get('/banks', asyncHandler(settingsController.listBanks));

// PUT bank-account: chỉ ADMIN cấu hình (master data / cấu hình hệ thống — đúng ranh giới RBAC).
router.put(
  '/bank-account',
  requireRole('ADMIN'),
  validate(updateBankAccountBodySchema, 'body'),
  asyncHandler(settingsController.updateBankAccount),
);

// GET transactions: Lịch sử giao dịch (proxy SePay). Admin + Manager đọc được (đọc từ tài khoản đã cấu
// hình). Token SePay ở env — KHÔNG lộ ra FE.
router.get(
  '/transactions',
  requireRole('MANAGER', 'ADMIN'),
  validate(listTransactionsQuerySchema, 'query'),
  asyncHandler(settingsController.listTransactions),
);

export default router;
