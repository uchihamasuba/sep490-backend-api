import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { supplierService } from './supplier.service';
import type {
  CreateSupplierBody,
  ListSupplierTransactionsQuery,
  ListSuppliersQuery,
  ListSupplierItemsQuery,
  ReceiveTransactionItemBody,
  SupplierIdParam,
  TransactionIdParam,
  TransactionItemParam,
  UpdateSupplierBody,
  UpdateSupplierStatusBody,
  AssignSupplierItemBody,
  UpdateSupplierItemBody,
  SupplierItemParam,
  CreateSupplierTransactionBody,
  UpdateSupplierTransactionBody,
  UpdateSupplierTransactionStatusBody,
  UpdateSupplierTransactionPaymentStatusBody,
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

async function updateStatus(req: Request, res: Response) {
  const { id } = req.params as unknown as SupplierIdParam;
  const body = req.body as UpdateSupplierStatusBody;
  const supplier = await supplierService.updateSupplierStatus(id, body.status);
  ok(res, supplier);
}

async function getItems(req: Request, res: Response) {
  const { id } = req.params as unknown as SupplierIdParam;
  const query = req.query as unknown as ListSupplierItemsQuery;
  const result = await supplierService.getSupplierItems(id, query);
  ok(res, result.data, result.meta);
}

async function listTransactions(req: Request, res: Response) {
  const query = req.query as unknown as ListSupplierTransactionsQuery;
  const result = await supplierService.listSupplierTransactions(query);
  ok(res, result.data, { ...result.meta });
}

async function getTransactionById(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as unknown as TransactionIdParam;
  const transaction = await supplierService.getSupplierTransactionById(id, req.user);
  ok(res, transaction);
}

async function receiveTransactionItem(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { transactionId, stItemId } = req.params as unknown as TransactionItemParam;
  const body = req.body as ReceiveTransactionItemBody;
  const item = await supplierService.receiveTransactionItem(transactionId, stItemId, body, req.user);
  ok(res, item);
}

async function remove(req: Request, res: Response) {
  const { id } = req.params as unknown as SupplierIdParam;
  await supplierService.deleteSupplier(id);
  ok(res, { message: 'Đã xóa nhà cung cấp' });
}

async function assignItem(req: Request, res: Response) {
  const { id } = req.params as unknown as SupplierIdParam;
  const body = req.body as AssignSupplierItemBody;
  const item = await supplierService.assignItemToSupplier(id, body);
  created(res, item);
}

async function updateItem(req: Request, res: Response) {
  const { id, itemId } = req.params as unknown as SupplierItemParam;
  const body = req.body as UpdateSupplierItemBody;
  const item = await supplierService.updateSupplierItem(id, itemId, body);
  ok(res, item);
}

async function removeItem(req: Request, res: Response) {
  const { id, itemId } = req.params as unknown as SupplierItemParam;
  await supplierService.removeSupplierItem(id, itemId);
  ok(res, { message: 'Đã bỏ gán mặt hàng' });
}

async function getNextSupplierCode(_req: Request, res: Response) {
  const result = await supplierService.getNextSupplierCode();
  ok(res, result);
}

async function createTransaction(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const body = req.body as CreateSupplierTransactionBody;
  const transaction = await supplierService.createSupplierTransaction(body, req.user);
  created(res, transaction);
}

async function updateTransaction(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as unknown as TransactionIdParam;
  const body = req.body as UpdateSupplierTransactionBody;
  const transaction = await supplierService.updateSupplierTransaction(id, body, req.user);
  ok(res, transaction);
}

async function deleteTransaction(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as unknown as TransactionIdParam;
  await supplierService.deleteSupplierTransaction(id, req.user);
  ok(res, { message: 'Đã xóa giao dịch nhà cung cấp' });
}

async function updateTransactionStatus(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as unknown as TransactionIdParam;
  const body = req.body as UpdateSupplierTransactionStatusBody;
  const transaction = await supplierService.updateTransactionStatus(id, body, req.user);
  ok(res, transaction);
}

// Staff LEAD (hoặc Manager/Admin) xác nhận "đã nhận" — chỉ Đã duyệt → Đã nhận (xem service).
async function receiveTransaction(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as unknown as TransactionIdParam;
  const transaction = await supplierService.receiveSupplierTransaction(id, req.user);
  ok(res, transaction);
}

async function updateTransactionPaymentStatus(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as unknown as TransactionIdParam;
  const body = req.body as UpdateSupplierTransactionPaymentStatusBody;
  const transaction = await supplierService.updateTransactionPaymentStatus(id, body, req.user);
  ok(res, transaction);
}

export const supplierController = {
  list,
  create,
  getById,
  update,
  updateStatus,
  getItems,
  listTransactions,
  getTransactionById,
  receiveTransactionItem,
  remove,
  assignItem,
  updateItem,
  removeItem,
  getNextSupplierCode,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  updateTransactionStatus,
  receiveTransaction,
  updateTransactionPaymentStatus,
};
