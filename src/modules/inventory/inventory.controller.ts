import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { inventoryService } from './inventory.service';
import type {
  AdjustInventoryBody,
  ConfirmReportBody,
  CreateInventoryBody,
  CreateReportBody,
  ItemIdParam,
  InventoryDetailQuery,
  ListInventoryQuery,
  ListMovementsQuery,
  ListReportsQuery,
  ListReservationsQuery,
  OrderIdParam,
  RepairInventoryBody,
  ReportIdParam,
  ReservationsTimelineQuery,
  ScrapInventoryBody,
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
  const { date } = req.query as unknown as InventoryDetailQuery;
  const inventory = await inventoryService.getInventoryByItemId(itemId, date);
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

async function create(req: Request, res: Response) {
  const body = req.body as CreateInventoryBody;
  const inventory = await inventoryService.createInventory(body);
  created(res, inventory);
}

async function adjust(req: Request, res: Response) {
  const actor = requireActor(req);
  const body = req.body as AdjustInventoryBody;
  const inventory = await inventoryService.adjustInventory(body, actor.id);
  ok(res, inventory);
}

async function repair(req: Request, res: Response) {
  const body = req.body as RepairInventoryBody;
  const inventory = await inventoryService.repairInventory(body);
  ok(res, inventory);
}

async function scrap(req: Request, res: Response) {
  const actor = requireActor(req);
  const body = req.body as ScrapInventoryBody;
  const inventory = await inventoryService.scrapInventory(body, actor.id);
  ok(res, inventory);
}

async function listItemReservations(req: Request, res: Response) {
  const { itemId } = req.params as unknown as ItemIdParam;
  const { from, to } = req.query as unknown as ListReservationsQuery;
  const data = await inventoryService.listItemReservations(itemId, from, to);
  ok(res, data);
}

async function reconcile(_req: Request, res: Response) {
  const result = await inventoryService.reconcileInventory();
  ok(res, result);
}

async function reservationsTimeline(req: Request, res: Response) {
  const { from, to, categoryId } = req.query as unknown as ReservationsTimelineQuery;
  const start = from ?? new Date();
  const end = to ?? new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const result = await inventoryService.listReservationsTimeline(start, end, categoryId);
  ok(res, result);
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
  const report = await inventoryService.createReport(body, actor);
  created(res, report);
}

async function confirmReport(req: Request, res: Response) {
  const actor = requireActor(req);
  const { reportId } = req.params as unknown as ReportIdParam;
  void (req.body as ConfirmReportBody);
  const report = await inventoryService.confirmReport(reportId, actor);
  ok(res, report);
}

export const inventoryController = {
  list,
  getByItemId,
  create,
  listMovements,
  getPicklist,
  adjust,
  repair,
  scrap,
  reconcile,
  reservationsTimeline,
  listItemReservations,
  listReports,
  getReportById,
  createReport,
  confirmReport,
};
