import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { scheduleRepository } from '../schedule.repository';
import { scheduleService } from '../schedule.service';

jest.mock('../schedule.repository', () => ({
  scheduleRepository: {
    findById: jest.fn(),
    delete: jest.fn(),
    orderExists: jest.fn(),
    taskExists: jest.fn(),
    findUserById: jest.fn(),
    createBatch: jest.fn(),
  },
}));

const mockedRepo = scheduleRepository as jest.Mocked<typeof scheduleRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakePlan(overrides: Record<string, unknown> = {}) {
  return {
    planId: 'plan-1',
    planCode: 'PLN-001',
    orderId: 'ord-1',
    order: {
      orderCode: 'ORD-001',
      eventName: 'Tech Summit 2026',
      eventDate: new Date('2026-08-15T02:00:00Z'),
      location: '123 Tech St. Hall A',
      customer: { customerName: 'Nguyen Minh Tri' },
    },
    taskId: 'task-1',
    task: { taskId: 'task-1', taskName: 'Lắp đặt thiết bị' },
    startTime: new Date('2026-08-14T07:00:00Z'),
    endTime: new Date('2026-08-14T11:00:00Z'),
    location: '123 Tech St. Hall A',
    status: 'PENDING',
    notes: null,
    assignees: [],
    ...overrides,
  };
}

describe('scheduleService.deleteSchedulePlan', () => {
  it('deletes a PENDING plan', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }) as never);
    await scheduleService.deleteSchedulePlan('plan-1');
    expect(mockedRepo.delete).toHaveBeenCalledWith('plan-1');
  });

  it('rejects deleting an IN_PROGRESS plan with 400', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'IN_PROGRESS' }) as never);
    await expect(scheduleService.deleteSchedulePlan('plan-1')).rejects.toMatchObject({ status: 400 });
    expect(mockedRepo.delete).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/schedule-plans/:planId is forbidden for non-Manager roles', async () => {
    const res = await request(app).delete('/api/v1/schedule-plans/plan-1').set('Authorization', authHeader('LEADER'));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/v1/schedule-plans/:planId deletes end-to-end', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'CANCELLED' }) as never);
    const res = await request(app).delete('/api/v1/schedule-plans/plan-1').set('Authorization', authHeader('MANAGER'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ planId: 'plan-1' });
  });
});

describe('scheduleService.createSchedulePlansBatch', () => {
  it('throws 404 when the order does not exist', async () => {
    mockedRepo.orderExists.mockResolvedValue(null);

    await expect(
      scheduleService.createSchedulePlansBatch(
        { orderId: 'missing', plans: [{ taskId: 'task-1', startTime: new Date(), assignees: [] }] } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 404 when a taskId in the batch does not exist', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' } as never);
    mockedRepo.taskExists.mockResolvedValue(null);

    await expect(
      scheduleService.createSchedulePlansBatch(
        { orderId: 'ord-1', plans: [{ taskId: 'ghost-task', startTime: new Date(), assignees: [] }] } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockedRepo.createBatch).not.toHaveBeenCalled();
  });

  it('creates multiple plans for the same order in one call', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' } as never);
    mockedRepo.taskExists.mockResolvedValue({ taskId: 'task-1' } as never);
    mockedRepo.createBatch.mockResolvedValue([
      fakePlan({ planId: 'plan-1' }),
      fakePlan({ planId: 'plan-2' }),
    ] as never);

    const result = await scheduleService.createSchedulePlansBatch(
      {
        orderId: 'ord-1',
        plans: [
          { taskId: 'task-1', startTime: new Date('2026-08-14T07:00:00Z'), assignees: [] },
          { taskId: 'task-1', startTime: new Date('2026-08-15T07:00:00Z'), assignees: [] },
        ],
      } as never,
      'user-1',
    );

    expect(result).toHaveLength(2);
    expect(mockedRepo.createBatch).toHaveBeenCalledWith('ord-1', 'user-1', expect.any(Array));
  });

  it('POST /api/v1/schedule-plans/batch rejects an empty plans array with 400', async () => {
    const res = await request(app)
      .post('/api/v1/schedule-plans/batch')
      .set('Authorization', authHeader('MANAGER'))
      .send({ orderId: 'ord-1', plans: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.orderExists).not.toHaveBeenCalled();
  });

  it('POST /api/v1/schedule-plans/batch is forbidden for non-Manager roles', async () => {
    const res = await request(app)
      .post('/api/v1/schedule-plans/batch')
      .set('Authorization', authHeader('TECHNICAL'))
      .send({ orderId: 'ord-1', plans: [{ taskId: 'task-1', startTime: '2026-08-14T07:00:00Z', assignees: [] }] });

    expect(res.status).toBe(403);
  });
});
