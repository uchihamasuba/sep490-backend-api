import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { settingsController } from './settings.controller';

// Mounted at /api/v1/settings
const router = Router();

router.use(requireAuth);

// Manager + Admin đều đọc được (docs/api/more-require.md mục 1, đề xuất 2) — dùng cho trang chi tiết
// đặt cọc/quyết toán ở cả 2 role.
router.get('/bank-account', requireRole('MANAGER', 'ADMIN'), asyncHandler(settingsController.getBankAccount));

export default router;
