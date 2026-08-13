import { evidenceRepository } from '../evidence.repository';
import { prisma } from '../../../db/prisma';
import { getEvidenceBucket } from '../../../config/firebase';

jest.mock('../../../db/prisma', () => ({
  prisma: {
    evidence: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../../../config/firebase', () => ({
  getEvidenceBucket: jest.fn(),
}));

describe('evidenceRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findById', async () => {
    (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({ evidenceId: 'e1' });
    const result = await evidenceRepository.findById('e1');
    expect(prisma.evidence.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { evidenceId: 'e1' },
    }));
    expect(result).toEqual({ evidenceId: 'e1' });
  });

  it('create', async () => {
    (prisma.evidence.create as jest.Mock).mockResolvedValue({ evidenceId: 'e1' });
    const data = { fileUrl: 'url', description: 'desc', uploadedBy: 'u1' };
    const result = await evidenceRepository.create(data);
    expect(prisma.evidence.create).toHaveBeenCalledWith(expect.objectContaining({
      data,
    }));
    expect(result).toEqual({ evidenceId: 'e1' });
  });

  it('uploadFile', async () => {
    const mockFileSave = jest.fn().mockResolvedValue({});
    const mockBucket = {
      name: 'test-bucket',
      file: jest.fn().mockReturnValue({ save: mockFileSave }),
    };
    (getEvidenceBucket as jest.Mock).mockReturnValue(mockBucket);

    const buffer = Buffer.from('test');
    const result = await evidenceRepository.uploadFile('path/to/file.jpg', buffer, 'image/jpeg');

    expect(getEvidenceBucket).toHaveBeenCalled();
    expect(mockBucket.file).toHaveBeenCalledWith('path/to/file.jpg');
    expect(mockFileSave).toHaveBeenCalledWith(buffer, { metadata: { contentType: 'image/jpeg' }, public: true });
    expect(result).toBe('https://storage.googleapis.com/test-bucket/path/to/file.jpg');
  });
});
