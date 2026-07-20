import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { orderService } from './order.service';
import type {
  CreateOrderBody,
  ListOrdersQuery,
  OrderIdParam,
  UpdateOrderItemsBody,
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

export const orderController = {
  list,
  getById,
  create,
  updateStatus,
  updateItems,
};
