import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response';
import { catalogService } from './catalog.service';
import type {
  CategoryIdParam,
  CreateCatalogItemBody,
  CreateCategoryBody,
  ItemIdParam,
  ListCatalogItemsQuery,
  ListCategoriesQuery,
  ListTypesQuery,
  UpdateCatalogItemBody,
  UpdateCatalogItemStatusBody,
  UpdateCategoryBody,
} from './catalog.validators';

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

async function getById(req: Request, res: Response) {
  const { itemId } = req.params as unknown as ItemIdParam;
  const item = await catalogService.getItemById(itemId);
  ok(res, item);
}

async function update(req: Request, res: Response) {
  const { itemId } = req.params as unknown as ItemIdParam;
  const body = req.body as UpdateCatalogItemBody;
  const item = await catalogService.updateItem(itemId, body);
  ok(res, item);
}

async function updateStatus(req: Request, res: Response) {
  const { itemId } = req.params as unknown as ItemIdParam;
  const { status } = req.body as UpdateCatalogItemStatusBody;
  const item = await catalogService.updateItemStatus(itemId, status);
  ok(res, item);
}

async function listCategories(req: Request, res: Response) {
  const query = req.query as unknown as ListCategoriesQuery;
  const result = await catalogService.listCategories(query);
  ok(res, result.data, { ...result.meta });
}

async function createCategory(req: Request, res: Response) {
  const body = req.body as CreateCategoryBody;
  const category = await catalogService.createCategory(body);
  created(res, category);
}

async function updateCategory(req: Request, res: Response) {
  const { categoryId } = req.params as unknown as CategoryIdParam;
  const body = req.body as UpdateCategoryBody;
  const category = await catalogService.updateCategory(categoryId, body);
  ok(res, category);
}

async function listTypes(req: Request, res: Response) {
  const query = req.query as unknown as ListTypesQuery;
  const result = await catalogService.listTypes(query);
  ok(res, result.data, { ...result.meta });
}

export const catalogController = {
  list,
  create,
  getById,
  update,
  updateStatus,
  listCategories,
  createCategory,
  updateCategory,
  listTypes,
};
