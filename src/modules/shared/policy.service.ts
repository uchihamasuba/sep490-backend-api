import type { BusinessPolicy } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { policyRepository } from './policy.repository';
import type { CreatePolicyBody, ListPoliciesQuery, UpdatePolicyBody } from './policy.validators';

export interface PolicyDTO {
  policyId: string;
  policyCode: string;
  policyName: string;
  policyType: string;
  description: string | null;
  policyValue: number;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

function mapPolicy(row: BusinessPolicy): PolicyDTO {
  return {
    policyId: row.policyId,
    policyCode: row.policyCode,
    policyName: row.policyName,
    policyType: row.policyType,
    description: row.description,
    policyValue: Number(row.policyValue),
    unit: row.unit,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function listPolicies(query: ListPoliciesQuery): Promise<{ data: PolicyDTO[]; meta: PolicyListMeta }> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const { rows, totalItems } = await policyRepository.findMany({
    policyType: query.policyType,
    isActive: query.isActive,
    search: query.search,
    skip,
    take: limit,
  });

  return {
    data: rows.map(mapPolicy),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
}

async function createPolicy(body: CreatePolicyBody): Promise<PolicyDTO> {
  const existing = await policyRepository.findByCode(body.policyCode);
  if (existing) throw AppError.conflict('policyCode already exists');

  const created = await policyRepository.create({
    policyCode: body.policyCode,
    policyName: body.policyName,
    policyType: body.policyType,
    policyValue: body.policyValue,
    unit: body.unit,
    description: body.description ?? null,
  });

  return mapPolicy(created);
}

async function updatePolicy(policyId: string, body: UpdatePolicyBody): Promise<PolicyDTO> {
  const existing = await policyRepository.findById(policyId);
  if (!existing) throw AppError.notFound('Policy not found');

  const updated = await policyRepository.update(policyId, {
    ...(body.policyValue !== undefined ? { policyValue: body.policyValue } : {}),
    ...(body.unit !== undefined ? { unit: body.unit } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
  });

  return mapPolicy(updated);
}

export const policyService = {
  listPolicies,
  createPolicy,
  updatePolicy,
};
