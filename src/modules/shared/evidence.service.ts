import { AppError } from '../../utils/AppError';
import { evidenceRepository, type EvidenceWithUploader } from './evidence.repository';

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

export const evidenceService = {
  getEvidenceById,
};
