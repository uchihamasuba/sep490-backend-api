import type { BusinessPolicy } from '@prisma/client';
import { policyRepository } from './policy.repository';
import type { ListPoliciesQuery } from './policy.validators';

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

export const policyService = {
  listPolicies,
};
