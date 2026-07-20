import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { evidenceService } from './evidence.service';
import type { EvidenceIdParam } from './evidence.validators';

async function getById(req: Request, res: Response) {
  const { id } = req.params as unknown as EvidenceIdParam;
  const evidence = await evidenceService.getEvidenceById(id);
  ok(res, evidence);
}

export const evidenceController = {
  getById,
};
