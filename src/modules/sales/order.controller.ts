import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { orderService } from './order.service';
import type {
  CloseOrderBody,
  ConfirmPreparedItemsBody,
  CreateDepositBody,
  CreateOrderBody,
  CreateSettlementBody,
  ExportEquipmentBody,
  ListOrdersQuery,
  ListPicklistsQuery,
  OrderIdParam,
  OrderItemIdParam,
  UpdateLiveChecklistBody,
  UpdateOrderItemBody,
  UpdateOrderItemsBody,
  UpdateOrderQuotationBody,
  UpdateOrderStatusBody,
} from './order.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListOrdersQuery;
  const result = await orderService.listOrders(query);
  ok(res, result.data, { ...result.meta });
}

async function getById(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const order = await orderService.getOrderById(orderId);
  ok(res, order);
}

async function create(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const body = req.body as CreateOrderBody;
  const result = await orderService.createOrder(body, req.user.id);
  created(res, result);
}

async function updateStatus(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const body = req.body as UpdateOrderStatusBody;
  const order = await orderService.updateOrderStatus(orderId, body);
  ok(res, order);
}

async function updateItems(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const body = req.body as UpdateOrderItemsBody;
  const order = await orderService.updateOrderItems(orderId, body.items);
  ok(res, order);
}

async function remove(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  await orderService.deleteOrder(orderId);
  ok(res, { orderId });
}

async function stats(_req: Request, res: Response) {
  const result = await orderService.getOrderStats();
  ok(res, result);
}

async function survey(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const result = await orderService.getOrderSurvey(orderId);
  ok(res, result);
}

async function deposits(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const result = await orderService.getOrderDeposits(orderId);
  ok(res, result);
}

async function settlement(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const result = await orderService.getOrderSettlement(orderId);
  ok(res, result);
}

async function updateItem(req: Request, res: Response) {
  const { orderId, orderItemId } = req.params as unknown as OrderItemIdParam;
  const body = req.body as UpdateOrderItemBody;
  const order = await orderService.updateOrderItem(orderId, orderItemId, body);
  ok(res, order);
}

async function updateLiveChecklist(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const body = req.body as UpdateLiveChecklistBody;
  const checklist = await orderService.updateLiveChecklist(orderId, body);
  ok(res, checklist);
}

async function updateQuotation(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const body = req.body as UpdateOrderQuotationBody;
  const order = await orderService.updateOrderQuotation(orderId, body);
  ok(res, order);
}

async function createDeposit(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { orderId } = req.params as unknown as OrderIdParam;
  const body = req.body as CreateDepositBody;
  const deposit = await orderService.createDeposit(orderId, body, req.user.id);
  created(res, deposit);
}

async function createSettlement(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { orderId } = req.params as unknown as OrderIdParam;
  const body = req.body as CreateSettlementBody;
  const result = await orderService.createSettlement(orderId, body, req.user.id);
  created(res, result);
}

async function close(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { orderId } = req.params as unknown as OrderIdParam;
  const body = req.body as CloseOrderBody;
  const order = await orderService.closeOrder(orderId, req.user.id, body);
  ok(res, order);
}

async function confirmPreparedItems(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const body = req.body as ConfirmPreparedItemsBody;
  const order = await orderService.confirmPreparedItems(orderId, body);
  ok(res, order);
}

async function listPicklists(req: Request, res: Response) {
  const query = req.query as unknown as ListPicklistsQuery;
  const result = await orderService.listPicklists(query);
  ok(res, result.data, { ...result.meta });
}

async function markPicklistPickedUp(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { orderId } = req.params as unknown as OrderIdParam;
  const result = await orderService.markPicklistPickedUp(orderId, req.user.id);
  ok(res, result);
}

async function exportEquipment(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { orderId } = req.params as unknown as OrderIdParam;
  const body = req.body as ExportEquipmentBody;
  const result = await orderService.exportEquipment(orderId, req.user.id, body.notes ?? null);
  ok(res, result);
}

export const orderController = {
  list,
  getById,
  create,
  updateStatus,
  updateItems,
  remove,
  stats,
  survey,
  deposits,
  settlement,
  updateItem,
  updateLiveChecklist,
  updateQuotation,
  createDeposit,
  createSettlement,
  close,
  confirmPreparedItems,
  exportEquipment,
  listPicklists,
  markPicklistPickedUp,
};
