import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export const userRepository = {
  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  findById(userId: string) {
    return prisma.user.findUnique({ where: { userId } });
  },

  update(userId: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { userId }, data });
  },

  updatePasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({ where: { userId }, data: { passwordHash } });
  },
};
