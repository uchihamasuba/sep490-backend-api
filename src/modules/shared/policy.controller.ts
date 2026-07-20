import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response';
import { policyService } from './policy.service';
import type { CreatePolicyBody, ListPoliciesQuery, PolicyIdParam, UpdatePolicyBody } from './policy.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListPoliciesQuery;
  const result = await policyService.listPolicies(query);
  ok(res, result.data, { ...result.meta });
}

async function create(req: Request, res: Response) {
  const body = req.body as CreatePolicyBody;
  const policy = await policyService.createPolicy(body);
  created(res, policy);
}

async function update(req: Request, res: Response) {
  const { policyId } = req.params as unknown as PolicyIdParam;
  const body = req.body as UpdatePolicyBody;
  const policy = await policyService.updatePolicy(policyId, body);
  ok(res, policy);
}

export const policyController = {
  list,
  create,
  update,
};
