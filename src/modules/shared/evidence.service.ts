import { randomUUID } from 'crypto';
import path from 'path';
import { AppError } from '../../utils/AppError';
import { evidenceRepository, type EvidenceWithUploader } from './evidence.repository';

export interface UploadEvidenceFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export interface EvidenceDTO {
  evidenceId: string;
  fileUrl: string;
  description: string | null;
  uploadedBy: { userId: string; fullName: string };
  createdAt: string;
}

function mapEvidence(row: EvidenceWithUploader): EvidenceDTO {
  return {
    evidenceId: row.evidenceId,
    fileUrl: row.fileUrl,
    description: row.description,
    uploadedBy: { userId: row.uploader.userId, fullName: row.uploader.fullName },
    createdAt: row.createdAt.toISOString(),
  };
}

async function getEvidenceById(evidenceId: string): Promise<EvidenceDTO> {
  const row = await evidenceRepository.findById(evidenceId);
  if (!row) throw AppError.notFound('Evidence not found');
  return mapEvidence(row);
}

// POST /evidence/upload — multipart, lưu file lên Firebase Storage rồi tạo bản ghi Evidence.
async function uploadEvidence(
  file: UploadEvidenceFile,
  description: string | undefined,
  uploadedBy: string,
): Promise<EvidenceDTO> {
  const ext = path.extname(file.originalname);
  const objectPath = `evidences/${randomUUID()}${ext}`;
  const fileUrl = await evidenceRepository.uploadFile(objectPath, file.buffer, file.mimetype);
  const row = await evidenceRepository.create({ fileUrl, description: description ?? null, uploadedBy });
  return mapEvidence(row);
}

export const evidenceService = {
  getEvidenceById,
  uploadEvidence,
};
