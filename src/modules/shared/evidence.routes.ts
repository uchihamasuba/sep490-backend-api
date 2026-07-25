import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import multer, { MulterError } from 'multer';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { evidenceController } from './evidence.controller';
import { evidenceIdParamSchema, uploadEvidenceBodySchema } from './evidence.validators';

// Mounted at /api/v1/evidence — GET đọc minh chứng, POST /upload dùng chung cho mọi luồng cần đính kèm
// ảnh (survey-reports, schedule-plans, deposits...) rồi gắn evidenceId ngược lại vào payload nghiệp vụ
// tương ứng (docs/api/lichtrinhkythuat_api.md mục 0/7).
const router = Router();

router.use(requireAuth);

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(AppError.badRequest(`Định dạng file không được hỗ trợ: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// MulterError.message luôn là tiếng Anh cứng (vd "File too large") — map theo code sang tiếng Việt
// thay vì lộ nguyên message gốc ra response.
const MULTER_ERROR_MESSAGES: Partial<Record<MulterError['code'], string>> = {
  LIMIT_FILE_SIZE: 'Dung lượng file vượt quá giới hạn cho phép (tối đa 10MB)',
  LIMIT_UNEXPECTED_FILE: 'Field file không hợp lệ, vui lòng gửi file qua field "file"',
  LIMIT_FILE_COUNT: 'Chỉ được tải lên 1 file',
};

function mapMulterError(err: MulterError): AppError {
  return AppError.badRequest(MULTER_ERROR_MESSAGES[err.code] ?? 'Tải file lên thất bại, vui lòng thử lại');
}

// multer's single() calls its callback with the error instead of calling next() with it — wrap so
// MulterError (and our AppError from fileFilter) both flow into the shared errorHandler correctly.
function uploadSingleFile(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err instanceof MulterError) return next(mapMulterError(err));
    next(err);
  });
}

router.get('/:id', validate(evidenceIdParamSchema, 'params'), asyncHandler(evidenceController.getById));

router.post(
  '/upload',
  uploadSingleFile as RequestHandler,
  validate(uploadEvidenceBodySchema, 'body'),
  asyncHandler(evidenceController.upload),
);

export default router;
