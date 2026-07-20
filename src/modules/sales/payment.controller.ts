import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { ok } from '../../utils/response';
import { paymentService } from './payment.service';
import type { DepositIdParam, SettlementIdParam, UpdateDepositStatusBody } from './payment.validators';

async function updateDepositStatus(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { depositId } = req.params as unknown as DepositIdParam;
  const body = req.body as UpdateDepositStatusBody;
  const deposit = await paymentService.updateDepositStatus(depositId, body, req.user.id);
  ok(res, deposit);
}

async function confirmSettlement(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { settlementId } = req.params as unknown as SettlementIdParam;
  const settlement = await paymentService.confirmSettlement(settlementId, req.user.id);
  ok(res, settlement);
}

export const paymentController = {
  updateDepositStatus,
  confirmSettlement,
};
