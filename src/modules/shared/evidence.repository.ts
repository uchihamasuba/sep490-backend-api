import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

const detailInclude = {
  uploader: { select: { userId: true, fullName: true } },
} satisfies Prisma.EvidenceInclude;

export type EvidenceWithUploader = Prisma.EvidenceGetPayload<{ include: typeof detailInclude }>;

export const evidenceRepository = {
  findById(evidenceId: string): Promise<EvidenceWithUploader | null> {
    return prisma.evidence.findUnique({ where: { evidenceId }, include: detailInclude });
  },
};
