import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface PolicyListFilter {
  policyType?: 'DEPOSIT' | 'CANCELLATION' | 'COMPENSATION' | 'FEE';
  isActive?: boolean;
  search?: string;
}

export interface PolicyListParams extends PolicyListFilter {
  skip: number;
  take: number;
}

function buildWhere(filter: PolicyListFilter): Prisma.BusinessPolicyWhereInput {
  const where: Prisma.BusinessPolicyWhereInput = {};
  if (filter.policyType) where.policyType = filter.policyType;
  if (filter.isActive !== undefined) where.isActive = filter.isActive;
  if (filter.search) {
    where.OR = [{ policyName: { contains: filter.search } }, { policyCode: { contains: filter.search } }];
  }
  return where;
}

export const policyRepository = {
  async findMany(params: PolicyListParams) {
    const where = buildWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.businessPolicy.findMany({ where, skip: params.skip, take: params.take, orderBy: { policyName: 'asc' } }),
      prisma.businessPolicy.count({ where }),
    ]);
    return { rows, totalItems };
  },
};
