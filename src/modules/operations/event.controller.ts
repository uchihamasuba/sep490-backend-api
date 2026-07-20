import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { eventService } from './event.service';
import type { EventOrderIdParam } from './event.validators';

async function getOverview(req: Request, res: Response) {
  const { orderId } = req.params as unknown as EventOrderIdParam;
  const overview = await eventService.getEventOverview(orderId);
  ok(res, overview);
}

export const eventController = {
  getOverview,
};
