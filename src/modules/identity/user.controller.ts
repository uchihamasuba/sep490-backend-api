import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { userService } from './user.service';
import type { ListUsersQuery, UpdateUserStatusBody, UserIdParam } from './user.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListUsersQuery;
  const result = await userService.listUsers(query);
  ok(res, result.data, { ...result.meta });
}

async function getById(req: Request, res: Response) {
  const { userId } = req.params as unknown as UserIdParam;
  const user = await userService.getUserById(userId);
  ok(res, user);
}

async function updateStatus(req: Request, res: Response) {
  const { userId } = req.params as unknown as UserIdParam;
  const { status } = req.body as UpdateUserStatusBody;
  const user = await userService.updateUserStatus(userId, status);
  ok(res, user);
}

export const userController = {
  list,
  getById,
  updateStatus,
};
