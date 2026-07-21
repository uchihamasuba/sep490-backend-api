import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { evidenceService } from './evidence.service';
import type { EvidenceIdParam, UploadEvidenceBody } from './evidence.validators';

async function getById(req: Request, res: Response) {
  const { id } = req.params as unknown as EvidenceIdParam;
  const evidence = await evidenceService.getEvidenceById(id);
  ok(res, evidence);
}

async function upload(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  if (!req.file) throw AppError.badRequest('file is required');

  const body = req.body as UploadEvidenceBody;
  const evidence = await evidenceService.uploadEvidence(req.file, body.description, req.user.id);
  created(res, evidence);
}

export const evidenceController = {
  getById,
  upload,
};
