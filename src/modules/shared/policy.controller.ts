import type { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { policyService } from './policy.service';
import type { ListPoliciesQuery } from './policy.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListPoliciesQuery;
  const result = await policyService.listPolicies(query);
  ok(res, result.data, { ...result.meta });
}

export const policyController = {
  list,
};
