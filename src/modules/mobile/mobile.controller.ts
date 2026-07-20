import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { mobileService } from './mobile.service';
import type { CreateMobileReportBody, MobileOrderIdParam } from './mobile.validators';

async function getOrder(req: Request, res: Response) {
  const { id } = req.params as unknown as MobileOrderIdParam;
  const order = await mobileService.getAssignedOrder(id);
  ok(res, order);
}

async function submitCollectedReport(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as unknown as MobileOrderIdParam;
  const body = req.body as CreateMobileReportBody;
  const report = await mobileService.submitCollectedReport(id, body, req.user.id);
  created(res, report);
}

export const mobileController = {
  getOrder,
  submitCollectedReport,
};
