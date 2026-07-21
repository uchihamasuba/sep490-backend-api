import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { settingsService } from './settings.service';

async function getBankAccount(_req: Request, res: Response) {
  const bankAccount = settingsService.getBankAccount();
  ok(res, bankAccount);
}

export const settingsController = {
  getBankAccount,
};
