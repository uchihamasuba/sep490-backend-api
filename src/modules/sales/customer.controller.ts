import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response';
import { customerService } from './customer.service';
import type {
  CreateCustomerBody,
  CustomerIdParam,
  ListCustomerOrdersQuery,
  ListCustomersQuery,
  UpdateCustomerBody,
} from './customer.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListCustomersQuery;
  const result = await customerService.listCustomers(query);
  ok(res, result.data, { ...result.meta });
}

async function create(req: Request, res: Response) {
  const body = req.body as CreateCustomerBody;
  const customer = await customerService.createCustomer(body);
  created(res, customer);
}

async function getById(req: Request, res: Response) {
  const { customerId } = req.params as unknown as CustomerIdParam;
  const customer = await customerService.getCustomerById(customerId);
  ok(res, customer);
}

async function update(req: Request, res: Response) {
  const { customerId } = req.params as unknown as CustomerIdParam;
  const body = req.body as UpdateCustomerBody;
  const customer = await customerService.updateCustomer(customerId, body);
  ok(res, customer);
}

async function remove(req: Request, res: Response) {
  const { customerId } = req.params as unknown as CustomerIdParam;
  await customerService.deleteCustomer(customerId);
  ok(res, { customerId });
}

async function summary(req: Request, res: Response) {
  const { customerId } = req.params as unknown as CustomerIdParam;
  const result = await customerService.getCustomerSummary(customerId);
  ok(res, result);
}

async function orders(req: Request, res: Response) {
  const { customerId } = req.params as unknown as CustomerIdParam;
  const query = req.query as unknown as ListCustomerOrdersQuery;
  const result = await customerService.getCustomerOrders(customerId, query);
  ok(res, result.data, { ...result.meta });
}

export const customerController = {
  list,
  create,
  getById,
  update,
  remove,
  summary,
  orders,
};
