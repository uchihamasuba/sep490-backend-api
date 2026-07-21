import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { scheduleService } from './schedule.service';
import type {
  AddAssigneeBody,
  AssigneeParam,
  BatchUpdateSchedulePlanStatusBody,
  CreateSchedulePlanBody,
  CreateSchedulePlansBatchBody,
  ListSchedulePlansQuery,
  PlanIdParam,
  UpdateSchedulePlanBody,
  UpdateSchedulePlanStatusBody,
} from './schedule.validators';

function requireActor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListSchedulePlansQuery;
  const result = await scheduleService.listSchedulePlans(query);
  ok(res, result.data, { ...result.meta });
}

async function getById(req: Request, res: Response) {
  const { planId } = req.params as unknown as PlanIdParam;
  const plan = await scheduleService.getSchedulePlanById(planId);
  ok(res, plan);
}

async function create(req: Request, res: Response) {
  const actor = requireActor(req);
  const body = req.body as CreateSchedulePlanBody;
  const plan = await scheduleService.createSchedulePlan(body, actor.id);
  created(res, plan);
}

async function update(req: Request, res: Response) {
  const { planId } = req.params as unknown as PlanIdParam;
  const body = req.body as UpdateSchedulePlanBody;
  const plan = await scheduleService.updateSchedulePlan(planId, body);
  ok(res, plan);
}

async function updateStatus(req: Request, res: Response) {
  const actor = requireActor(req);
  const { planId } = req.params as unknown as PlanIdParam;
  const body = req.body as UpdateSchedulePlanStatusBody;
  const plan = await scheduleService.updateSchedulePlanStatus(planId, body, actor);
  ok(res, plan);
}

async function addAssignee(req: Request, res: Response) {
  const { planId } = req.params as unknown as PlanIdParam;
  const body = req.body as AddAssigneeBody;
  const plan = await scheduleService.addAssignee(planId, body);
  created(res, plan);
}

async function removeAssignee(req: Request, res: Response) {
  const { planId, userId } = req.params as unknown as AssigneeParam;
  const plan = await scheduleService.removeAssignee(planId, userId);
  ok(res, plan);
}

async function checkIn(req: Request, res: Response) {
  const actor = requireActor(req);
  const { planId, userId } = req.params as unknown as AssigneeParam;
  const plan = await scheduleService.checkIn(planId, userId, actor);
  ok(res, plan);
}

async function checkOut(req: Request, res: Response) {
  const actor = requireActor(req);
  const { planId, userId } = req.params as unknown as AssigneeParam;
  const plan = await scheduleService.checkOut(planId, userId, actor);
  ok(res, plan);
}

async function listWorkTasks(_req: Request, res: Response) {
  const tasks = await scheduleService.listWorkTasks();
  ok(res, tasks);
}

async function remove(req: Request, res: Response) {
  const { planId } = req.params as unknown as PlanIdParam;
  await scheduleService.deleteSchedulePlan(planId);
  ok(res, { planId });
}

async function createBatch(req: Request, res: Response) {
  const actor = requireActor(req);
  const body = req.body as CreateSchedulePlansBatchBody;
  const plans = await scheduleService.createSchedulePlansBatch(body, actor.id);
  created(res, plans);
}

async function updateStatusBatch(req: Request, res: Response) {
  const body = req.body as BatchUpdateSchedulePlanStatusBody;
  const plans = await scheduleService.updateSchedulePlansStatusBatch(body);
  ok(res, plans);
}

export const scheduleController = {
  list,
  getById,
  create,
  update,
  updateStatus,
  addAssignee,
  removeAssignee,
  checkIn,
  checkOut,
  listWorkTasks,
  remove,
  createBatch,
  updateStatusBatch,
};
