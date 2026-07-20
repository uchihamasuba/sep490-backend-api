import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response';
import { catalogService } from './catalog.service';
import type { CreateCatalogItemBody, ListCatalogItemsQuery } from './catalog.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListCatalogItemsQuery;
  const result = await catalogService.listItems(query);
  ok(res, result.data, { ...result.meta });
}

async function create(req: Request, res: Response) {
  const body = req.body as CreateCatalogItemBody;
  const item = await catalogService.createItem(body);
  created(res, item);
}

export const catalogController = {
  list,
  create,
};
