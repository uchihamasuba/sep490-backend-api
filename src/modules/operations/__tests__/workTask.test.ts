import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { scheduleRepository } from '../schedule.repository';

jest.mock('../schedule.repository', () => {
  return {
    scheduleRepository: {
      listWorkTasks: jest.fn(),
      getWorkTaskById: jest.fn(),
      getWorkTaskByCode: jest.fn(),
      createWorkTask: jest.fn(),
      updateWorkTask: jest.fn(),
    },
  };
});

const mockedRepo = scheduleRepository as jest.Mocked<typeof scheduleRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF' = 'MANAGER', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('WorkTask API endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/work-tasks/:taskId', () => {
    it('returns the work task when it exists', async () => {
      mockedRepo.getWorkTaskById.mockResolvedValue({
        taskId: VALID_UUID,
        taskCode: 'T-001',
        taskName: 'Task 1',
        description: 'Desc',
        isActive: true,
      } as any);

      const res = await request(app).get(`/api/v1/work-tasks/${VALID_UUID}`).set('Authorization', authHeader('STAFF'));
      expect(res.status).toBe(200);
      expect(res.body.data.taskCode).toBe('T-001');
    });

    it('returns 404 if not found', async () => {
      mockedRepo.getWorkTaskById.mockResolvedValue(null);
      const res = await request(app).get(`/api/v1/work-tasks/${VALID_UUID}`).set('Authorization', authHeader('STAFF'));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/work-tasks', () => {
    it('creates a new work task', async () => {
      mockedRepo.getWorkTaskByCode.mockResolvedValue(null);
      mockedRepo.createWorkTask.mockResolvedValue({
        taskId: VALID_UUID,
        taskCode: 'T-NEW',
        taskName: 'New Task',
        description: null,
        isActive: true,
      } as any);

      const res = await request(app)
        .post('/api/v1/work-tasks')
        .set('Authorization', authHeader('MANAGER'))
        .send({ taskCode: 'T-NEW', taskName: 'New Task' });

      expect(res.status).toBe(201);
      expect(res.body.data.taskCode).toBe('T-NEW');
    });

    it('returns 400 if taskCode already exists', async () => {
      mockedRepo.getWorkTaskByCode.mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/work-tasks')
        .set('Authorization', authHeader('MANAGER'))
        .send({ taskCode: 'T-EXIST', taskName: 'Task' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/v1/work-tasks/:taskId', () => {
    it('updates work task correctly', async () => {
      mockedRepo.getWorkTaskById.mockResolvedValue({ taskId: VALID_UUID, taskCode: 'T-OLD' } as any);
      mockedRepo.getWorkTaskByCode.mockResolvedValue(null);
      mockedRepo.updateWorkTask.mockResolvedValue({
        taskId: VALID_UUID,
        taskCode: 'T-NEW',
        taskName: 'Updated',
        description: 'New desc',
        isActive: true,
      } as any);

      const res = await request(app)
        .put(`/api/v1/work-tasks/${VALID_UUID}`)
        .set('Authorization', authHeader('MANAGER'))
        .send({ taskCode: 'T-NEW', taskName: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.taskName).toBe('Updated');
    });

    it('returns 404 if not found', async () => {
      mockedRepo.getWorkTaskById.mockResolvedValue(null);
      const res = await request(app)
        .put(`/api/v1/work-tasks/${VALID_UUID}`)
        .set('Authorization', authHeader('MANAGER'))
        .send({ taskName: 'Updated' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/work-tasks/:taskId', () => {
    it('performs a soft delete (isActive: false)', async () => {
      mockedRepo.getWorkTaskById.mockResolvedValue({ taskId: VALID_UUID } as any);
      mockedRepo.updateWorkTask.mockResolvedValue({} as any);

      const res = await request(app)
        .delete(`/api/v1/work-tasks/${VALID_UUID}`)
        .set('Authorization', authHeader('MANAGER'));

      expect(res.status).toBe(200);
      expect(mockedRepo.updateWorkTask).toHaveBeenCalledWith(VALID_UUID, { isActive: false });
    });
  });
});
