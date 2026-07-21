import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response';
import { supplierService } from './supplier.service';
import type {
  CreateSupplierBody,
  ListSupplierTransactionsQuery,
  ListSuppliersQuery,
  SupplierIdParam,
  UpdateSupplierBody,
} from './supplier.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListSuppliersQuery;
  const result = await supplierService.listSuppliers(query);
  ok(res, result.data, { ...result.meta });
}

async function create(req: Request, res: Response) {
  const body = req.body as CreateSupplierBody;
  const supplier = await supplierService.createSupplier(body);
  created(res, supplier);
}

async function getById(req: Request, res: Response) {
  const { id } = req.params as unknown as SupplierIdParam;
  const supplier = await supplierService.getSupplierById(id);
  ok(res, supplier);
}

async function update(req: Request, res: Response) {
  const { id } = req.params as unknown as SupplierIdParam;
  const body = req.body as UpdateSupplierBody;
  const supplier = await supplierService.updateSupplier(id, body);
  ok(res, supplier);
}

async function listTransactions(req: Request, res: Response) {
  const query = req.query as unknown as ListSupplierTransactionsQuery;
  const result = await supplierService.listSupplierTransactions(query);
  ok(res, result.data, { ...result.meta });
}

export const supplierController = {
  list,
  create,
  getById,
  update,
  listTransactions,
};
