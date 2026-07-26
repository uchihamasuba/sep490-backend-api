import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { changeRequestService } from './changeRequest.service';
import type { ApproveChangeRequestBody, ChangeRequestIdParam, ListChangeRequestsQuery } from './changeRequest.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListChangeRequestsQuery;
  const result = await changeRequestService.listChangeRequests(query);
  ok(res, result.data, { ...result.meta });
}

async function approve(req: Request, res: Response) {
  const { changeRequestId } = req.params as unknown as ChangeRequestIdParam;
  const body = req.body as ApproveChangeRequestBody;
  const changeRequest = await changeRequestService.approveChangeRequest(changeRequestId, body);
  ok(res, changeRequest);
}

export const changeRequestController = {
  list,
  approve,
};
