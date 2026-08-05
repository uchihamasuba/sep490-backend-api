import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { scheduleService } from './schedule.service';
import type {
  AddAssigneeBody,
  AssigneeParam,
  AttachEvidenceBody,
  BatchUpdateSchedulePlanStatusBody,
  CheckInBody,
  CheckOutBody,
  CreateSchedulePlanBody,
  CreateSchedulePlansBatchBody,
  ListSchedulePlansQuery,
  ListWorkTasksQuery,
  PlanIdParam,
  TaskIdParam,
  CreateWorkTaskBody,
  UpdateWorkTaskBody,
  UpdateSchedulePlanBody,
  UpdateSchedulePlanStatusBody,
  WarehouseMovementBody,
  ListAttendancesQuery,
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
  const body = req.body as CheckInBody;
  const plan = await scheduleService.checkIn(planId, userId, actor, body.checkInEvidenceId, body.latitude, body.longitude);
  ok(res, plan);
}

async function checkOut(req: Request, res: Response) {
  const actor = requireActor(req);
  const { planId, userId } = req.params as unknown as AssigneeParam;
  const body = req.body as CheckOutBody;
  const plan = await scheduleService.checkOut(planId, userId, actor, body.latitude, body.longitude);
  ok(res, plan);
}

async function attachEvidence(req: Request, res: Response) {
  const actor = requireActor(req);
  const { planId } = req.params as unknown as PlanIdParam;
  const body = req.body as AttachEvidenceBody;
  const plan = await scheduleService.attachEvidence(planId, body.evidenceIds!, actor);
  ok(res, plan);
}

async function listWorkTasks(req: Request, res: Response) {
  const query = req.query as unknown as ListWorkTasksQuery;
  const result = await scheduleService.listWorkTasks(query);
  ok(res, result.data, result.meta);
}

async function getWorkTask(req: Request, res: Response) {
  const { taskId } = req.params as unknown as TaskIdParam;
  const result = await scheduleService.getWorkTask(taskId);
  ok(res, result);
}

async function createWorkTask(req: Request, res: Response) {
  const body = req.body as CreateWorkTaskBody;
  const result = await scheduleService.createWorkTask(body);
  created(res, result);
}

async function updateWorkTask(req: Request, res: Response) {
  const { taskId } = req.params as unknown as TaskIdParam;
  const body = req.body as UpdateWorkTaskBody;
  const result = await scheduleService.updateWorkTask(taskId, body);
  ok(res, result);
}

async function deleteWorkTask(req: Request, res: Response) {
  const { taskId } = req.params as unknown as TaskIdParam;
  await scheduleService.deleteWorkTask(taskId);
  ok(res, { taskId });
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

async function recordWarehouseMovement(req: Request, res: Response) {
  const actor = requireActor(req);
  const { planId } = req.params as unknown as PlanIdParam;
  const body = req.body as WarehouseMovementBody;
  const movements = await scheduleService.recordWarehouseMovement(planId, body, actor);
  created(res, movements);
}


async function listAttendances(req: Request, res: Response) {
  const query = req.query as unknown as ListAttendancesQuery;
  const result = await scheduleService.listAttendances(query);
  ok(res, result.data, { ...result.meta });
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
  attachEvidence,
  listWorkTasks,
  getWorkTask,
  createWorkTask,
  updateWorkTask,
  deleteWorkTask,
  remove,
  createBatch,
  updateStatusBatch,
  recordWarehouseMovement,
  listAttendances,
};
