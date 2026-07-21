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
      return cb(AppError.badRequest(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// multer's single() calls its callback with the error instead of calling next() with it — wrap so
// MulterError (and our AppError from fileFilter) both flow into the shared errorHandler correctly.
function uploadSingleFile(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err instanceof MulterError) return next(AppError.badRequest(err.message));
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
