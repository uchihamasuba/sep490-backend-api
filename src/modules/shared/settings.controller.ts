import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { settingsService } from './settings.service';
import type { ListTransactionsQuery, UpdateBankAccountBody } from './settings.validators';

async function getBankAccount(_req: Request, res: Response) {
  const bankAccount = await settingsService.getBankAccount();
  ok(res, bankAccount);
}

async function updateBankAccount(req: Request, res: Response) {
  const body = req.body as UpdateBankAccountBody;
  const bankAccount = await settingsService.updateBankAccount(body, req.user!.id);
  ok(res, bankAccount);
}

async function listTransactions(req: Request, res: Response) {
  const query = req.query as unknown as ListTransactionsQuery;
  const result = await settingsService.listTransactions(query);
  ok(res, result);
}

async function listBanks(_req: Request, res: Response) {
  const banks = await settingsService.listBanks();
  ok(res, banks);
}

export const settingsController = {
  getBankAccount,
  updateBankAccount,
  listTransactions,
  listBanks,
};
