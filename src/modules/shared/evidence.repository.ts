import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { getEvidenceBucket } from '../../config/firebase';

const detailInclude = {
  uploader: { select: { userId: true, fullName: true } },
} satisfies Prisma.EvidenceInclude;

export type EvidenceWithUploader = Prisma.EvidenceGetPayload<{ include: typeof detailInclude }>;

export const evidenceRepository = {
  findById(evidenceId: string): Promise<EvidenceWithUploader | null> {
    return prisma.evidence.findUnique({ where: { evidenceId }, include: detailInclude });
  },

  create(data: { fileUrl: string; description: string | null; uploadedBy: string }): Promise<EvidenceWithUploader> {
    return prisma.evidence.create({ data, include: detailInclude });
  },

  // Upload buffer lên Firebase Storage (Task 1.4, xem src/config/firebase.ts) — public URL dạng
  // storage.googleapis.com, không dùng signed URL (ảnh minh chứng không phải dữ liệu nhạy cảm cần hết hạn).
  async uploadFile(objectPath: string, buffer: Buffer, contentType: string): Promise<string> {
    const bucket = getEvidenceBucket();
    const file = bucket.file(objectPath);
    await file.save(buffer, { metadata: { contentType }, public: true });
    return `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
  },
};
