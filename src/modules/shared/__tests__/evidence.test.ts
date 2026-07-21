import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { evidenceRepository } from '../evidence.repository';

jest.mock('../evidence.repository', () => ({
  evidenceRepository: {
    findById: jest.fn(),
    create: jest.fn(),
    uploadFile: jest.fn(),
  },
}));

const mockedRepo = evidenceRepository as jest.Mocked<typeof evidenceRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

describe('GET /api/v1/evidence/:id', () => {
  it('returns the evidence record with uploader info', async () => {
    mockedRepo.findById.mockResolvedValue({
      evidenceId: 'evi-1',
      fileUrl: 'https://example.com/photo.jpg',
      description: 'Ảnh lắp đặt thiết bị',
      uploadedBy: 'user-1',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      uploader: { userId: 'user-1', fullName: 'Leader A' },
    } as never);

    const res = await request(app).get('/api/v1/evidence/evi-1').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      evidenceId: 'evi-1',
      fileUrl: 'https://example.com/photo.jpg',
      uploadedBy: { userId: 'user-1', fullName: 'Leader A' },
    });
  });

  it('returns 404 when the evidence does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/evidence/ghost').set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/evidence/evi-1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/evidence/upload', () => {
  it('uploads a file to storage and creates the evidence record', async () => {
    mockedRepo.uploadFile.mockResolvedValue('https://storage.googleapis.com/bucket/evidences/abc.jpg');
    mockedRepo.create.mockResolvedValue({
      evidenceId: 'evi-2',
      fileUrl: 'https://storage.googleapis.com/bucket/evidences/abc.jpg',
      description: 'Anh lap dat thiet bi',
      uploadedBy: 'user-1',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      uploader: { userId: 'user-1', fullName: 'Leader A' },
    } as never);

    const res = await request(app)
      .post('/api/v1/evidence/upload')
      .set('Authorization', authHeader())
      .field('description', 'Anh lap dat thiet bi')
      .attach('file', Buffer.from('fake-image-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      evidenceId: 'evi-2',
      fileUrl: 'https://storage.googleapis.com/bucket/evidences/abc.jpg',
      uploadedBy: { userId: 'user-1', fullName: 'Leader A' },
    });
    expect(mockedRepo.uploadFile).toHaveBeenCalledWith(expect.stringContaining('.jpg'), expect.any(Buffer), 'image/jpeg');
    expect(mockedRepo.create).toHaveBeenCalledWith({
      fileUrl: 'https://storage.googleapis.com/bucket/evidences/abc.jpg',
      description: 'Anh lap dat thiet bi',
      uploadedBy: 'user-1',
    });
  });

  it('rejects a request with no file attached (400)', async () => {
    const res = await request(app).post('/api/v1/evidence/upload').set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(mockedRepo.uploadFile).not.toHaveBeenCalled();
  });

  it('rejects an unsupported file type (400)', async () => {
    const res = await request(app)
      .post('/api/v1/evidence/upload')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('not-an-image'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(mockedRepo.uploadFile).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/evidence/upload')
      .attach('file', Buffer.from('fake-image-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
  });
});
