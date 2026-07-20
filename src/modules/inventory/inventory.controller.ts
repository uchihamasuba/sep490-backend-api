import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { inventoryService } from './inventory.service';
import type {
  AdjustInventoryBody,
  ConfirmReportBody,
  CreateReportBody,
  ItemIdParam,
  ListInventoryQuery,
  ListMovementsQuery,
  ListReportsQuery,
  OrderIdParam,
  ReleaseInventoryBody,
  ReportIdParam,
  ReserveInventoryBody,
} from './inventory.validators';

function requireActor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListInventoryQuery;
  const result = await inventoryService.listInventory(query);
  ok(res, result.data, { ...result.meta });
}

async function getByItemId(req: Request, res: Response) {
  const { itemId } = req.params as unknown as ItemIdParam;
  const inventory = await inventoryService.getInventoryByItemId(itemId);
  ok(res, inventory);
}

async function listMovements(req: Request, res: Response) {
  const query = req.query as unknown as ListMovementsQuery;
  const result = await inventoryService.listMovements(query);
  ok(res, result.data, { ...result.meta });
}

async function getPicklist(req: Request, res: Response) {
  const { orderId } = req.params as unknown as OrderIdParam;
  const picklist = await inventoryService.getPicklist(orderId);
  ok(res, picklist);
}

async function adjust(req: Request, res: Response) {
  const actor = requireActor(req);
  const body = req.body as AdjustInventoryBody;
  const inventory = await inventoryService.adjustInventory(body, actor.id);
  ok(res, inventory);
}

async function reserve(req: Request, res: Response) {
  const actor = requireActor(req);
  const body = req.body as ReserveInventoryBody;
  const inventory = await inventoryService.reserveInventory(body, actor.id);
  ok(res, inventory);
}

async function release(req: Request, res: Response) {
  const actor = requireActor(req);
  const body = req.body as ReleaseInventoryBody;
  const inventory = await inventoryService.releaseInventory(body, actor.id);
  ok(res, inventory);
}

async function listReports(req: Request, res: Response) {
  const query = req.query as unknown as ListReportsQuery;
  const result = await inventoryService.listReports(query);
  ok(res, result.data, { ...result.meta });
}

async function getReportById(req: Request, res: Response) {
  const { reportId } = req.params as unknown as ReportIdParam;
  const report = await inventoryService.getReportById(reportId);
  ok(res, report);
}

async function createReport(req: Request, res: Response) {
  const actor = requireActor(req);
  const body = req.body as CreateReportBody;
  const report = await inventoryService.createReport(body, actor.id);
  created(res, report);
}

async function confirmReport(req: Request, res: Response) {
  const actor = requireActor(req);
  const { reportId } = req.params as unknown as ReportIdParam;
  void (req.body as ConfirmReportBody);
  const report = await inventoryService.confirmReport(reportId, actor.id);
  ok(res, report);
}

export const inventoryController = {
  list,
  getByItemId,
  listMovements,
  getPicklist,
  adjust,
  reserve,
  release,
  listReports,
  getReportById,
  createReport,
  confirmReport,
};
