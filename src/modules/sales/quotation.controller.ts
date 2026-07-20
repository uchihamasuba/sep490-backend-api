import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { quotationService } from './quotation.service';
import type {
  CreateQuotationBody,
  CustomerIdParam,
  ListCustomerQuotationsQuery,
  ListQuotationsQuery,
  QuotationIdParam,
  UpdateQuotationBody,
  UpdateQuotationStatusBody,
} from './quotation.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListQuotationsQuery;
  const result = await quotationService.listQuotations(query);
  ok(res, result.data, { ...result.meta });
}

async function listByCustomer(req: Request, res: Response) {
  const { customerId } = req.params as unknown as CustomerIdParam;
  const query = req.query as unknown as ListCustomerQuotationsQuery;
  const result = await quotationService.listQuotationsByCustomer(customerId, query);
  ok(res, result.data, { ...result.meta });
}

async function getById(req: Request, res: Response) {
  const { quotationId } = req.params as unknown as QuotationIdParam;
  const quotation = await quotationService.getQuotationById(quotationId);
  ok(res, quotation);
}

async function createForCustomer(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { customerId } = req.params as unknown as CustomerIdParam;
  const body = req.body as CreateQuotationBody;
  const quotation = await quotationService.createQuotationForCustomer(customerId, body, req.user.id);
  created(res, quotation);
}

async function update(req: Request, res: Response) {
  const { quotationId } = req.params as unknown as QuotationIdParam;
  const body = req.body as UpdateQuotationBody;
  const quotation = await quotationService.updateQuotation(quotationId, body);
  ok(res, quotation);
}

async function updateStatus(req: Request, res: Response) {
  const { quotationId } = req.params as unknown as QuotationIdParam;
  const body = req.body as UpdateQuotationStatusBody;
  const quotation = await quotationService.updateQuotationStatus(quotationId, body.status);
  ok(res, quotation);
}

async function remove(req: Request, res: Response) {
  const { quotationId } = req.params as unknown as QuotationIdParam;
  await quotationService.deleteQuotation(quotationId);
  ok(res, { quotationId });
}

export const quotationController = {
  list,
  listByCustomer,
  getById,
  createForCustomer,
  update,
  updateStatus,
  remove,
};
