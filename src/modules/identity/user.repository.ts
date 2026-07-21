import type { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface UserListFilter {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}

export interface UserListParams extends UserListFilter {
  skip: number;
  take: number;
}

function buildWhere(filter: UserListFilter): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (filter.role) where.role = filter.role;
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    const q = filter.search;
    where.OR = [{ fullName: { contains: q } }, { username: { contains: q } }];
  }
  return where;
}

export const userRepository = {
  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  findById(userId: string) {
    return prisma.user.findUnique({ where: { userId } });
  },

  async findMany(params: UserListParams) {
    const where = buildWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.user.findMany({ where, skip: params.skip, take: params.take, orderBy: { fullName: 'asc' } }),
      prisma.user.count({ where }),
    ]);
    return { rows, totalItems };
  },

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  },

  update(userId: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { userId }, data });
  },

  updatePasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({ where: { userId }, data: { passwordHash } });
  },
};
