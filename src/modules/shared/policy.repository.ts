import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface PolicyListFilter {
  policyType?: 'DEPOSIT' | 'CANCELLATION' | 'COMPENSATION' | 'FEE' | 'WAGE';
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

  findById(policyId: string) {
    return prisma.businessPolicy.findUnique({ where: { policyId } });
  },

  findByCode(policyCode: string) {
    return prisma.businessPolicy.findUnique({ where: { policyCode } });
  },

  create(data: {
    policyCode: string;
    policyName: string;
    policyType: 'DEPOSIT' | 'CANCELLATION' | 'COMPENSATION' | 'FEE' | 'WAGE';
    policyValue: number;
    unit: string;
    description: string | null;
  }) {
    return prisma.businessPolicy.create({ data });
  },

  update(policyId: string, data: { policyValue?: number; unit?: string; description?: string | null; isActive?: boolean }) {
    return prisma.businessPolicy.update({ where: { policyId }, data });
  },
};
