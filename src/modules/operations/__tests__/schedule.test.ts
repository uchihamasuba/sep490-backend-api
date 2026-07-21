import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { scheduleRepository } from '../schedule.repository';
import { scheduleService } from '../schedule.service';
import type { Actor } from '../schedule.service';

jest.mock('../schedule.repository', () => ({
  scheduleRepository: {
    findMany: jest.fn(),
    findById: jest.fn(),
    generateNextPlanCode: jest.fn(),
    orderExists: jest.fn(),
    taskExists: jest.fn(),
    findUserById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    updateStatusBatch: jest.fn(),
    addAssignee: jest.fn(),
    removeAssignee: jest.fn(),
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    attachEvidence: jest.fn(),
    listWorkTasks: jest.fn(),
  },
}));

const mockedRepo = scheduleRepository as jest.Mocked<typeof scheduleRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

interface FakeAssignee {
  assigneeId: string;
  userId: string;
  role: 'LEAD' | 'TECHNICAL';
  user: { fullName: string; phone: string | null };
  attendance: { checkInAt: Date | null; checkOutAt: Date | null } | null;
}

function fakePlan(overrides: Record<string, unknown> = {}, assignees: FakeAssignee[] = []) {
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
    assignees,
    ...overrides,
  };
}

function fakeAssignee(overrides: Partial<FakeAssignee> = {}): FakeAssignee {
  return {
    assigneeId: 'assignee-1',
    userId: 'leader-1',
    role: 'LEAD',
    user: { fullName: 'Le Van Leader', phone: '0900000003' },
    attendance: null,
    ...overrides,
  };
}

function fakeUser(overrides: Record<string, unknown> = {}) {
  return { userId: 'leader-1', fullName: 'Le Van Leader', role: 'LEADER', ...overrides };
}

describe('scheduleService.createSchedulePlan', () => {
  it('throws 404 when the order does not exist', async () => {
    mockedRepo.orderExists.mockResolvedValue(null);

    await expect(
      scheduleService.createSchedulePlan(
        { orderId: 'missing', taskId: 'task-1', startTime: new Date(), assignees: [] } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 404 when an assignee userId does not exist', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.taskExists.mockResolvedValue({ taskId: 'task-1' } as never);
    mockedRepo.findUserById.mockResolvedValue(null);

    await expect(
      scheduleService.createSchedulePlan(
        {
          orderId: 'ord-1',
          taskId: 'task-1',
          startTime: new Date(),
          assignees: [{ userId: 'ghost-user', role: 'LEAD' }],
        } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 when the assignee user has an ineligible role (not LEADER/TECHNICAL)', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.taskExists.mockResolvedValue({ taskId: 'task-1' } as never);
    mockedRepo.findUserById.mockResolvedValue(fakeUser({ role: 'MANAGER' }) as never);

    await expect(
      scheduleService.createSchedulePlan(
        {
          orderId: 'ord-1',
          taskId: 'task-1',
          startTime: new Date(),
          assignees: [{ userId: 'manager-1', role: 'LEAD' }],
        } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('scheduleService.updateSchedulePlanStatus — permission + transition rules', () => {
  const manager: Actor = { id: 'mgr-1', role: 'MANAGER' };
  const leader: Actor = { id: 'leader-1', role: 'LEADER' };

  it('forbids a non-Manager from confirming a plan', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }, [fakeAssignee()]) as never);

    await expect(
      scheduleService.updateSchedulePlanStatus('plan-1', { status: 'CONFIRMED' } as never, leader),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows a Manager to confirm a PENDING plan', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }, [fakeAssignee()]) as never);
    mockedRepo.updateStatus.mockResolvedValue(fakePlan({ status: 'CONFIRMED' }, [fakeAssignee()]) as never);

    const result = await scheduleService.updateSchedulePlanStatus('plan-1', { status: 'CONFIRMED' } as never, manager);
    expect(result.status).toBe('CONFIRMED');
  });

  it('rejects confirming a plan that is not PENDING', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'CONFIRMED' }, [fakeAssignee()]) as never);

    await expect(
      scheduleService.updateSchedulePlanStatus('plan-1', { status: 'CONFIRMED' } as never, manager),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('forbids a Leader from cancelling a plan (IN_PROGRESS/COMPLETED no longer go through this endpoint)', async () => {
    await expect(
      scheduleService.updateSchedulePlanStatus('plan-1', { status: 'CANCELLED' } as never, leader),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });
});

describe('scheduleService.addAssignee', () => {
  it('throws 404 when the user does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }, []) as never);
    mockedRepo.findUserById.mockResolvedValue(null);

    await expect(
      scheduleService.addAssignee('plan-1', { userId: 'ghost', role: 'TECHNICAL' } as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockedRepo.addAssignee).not.toHaveBeenCalled();
  });

  it('throws 409 when the user is already assigned', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }, [fakeAssignee({ userId: 'leader-1' })]) as never);
    mockedRepo.findUserById.mockResolvedValue(fakeUser() as never);

    await expect(
      scheduleService.addAssignee('plan-1', { userId: 'leader-1', role: 'LEAD' } as never),
    ).rejects.toMatchObject({ status: 409 });
    expect(mockedRepo.addAssignee).not.toHaveBeenCalled();
  });

  it('throws 400 when the plan is already IN_PROGRESS/COMPLETED/CANCELLED', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'IN_PROGRESS' }, []) as never);

    await expect(
      scheduleService.addAssignee('plan-1', { userId: 'leader-1', role: 'LEAD' } as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('throws 409 when adding a 2nd LEAD to a plan that already has one (max 1 LEAD/plan)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'PENDING' }, [fakeAssignee({ userId: 'leader-1' })]) as never,
    );
    mockedRepo.findUserById.mockResolvedValue(fakeUser({ userId: 'leader-2', role: 'LEADER' }) as never);

    await expect(
      scheduleService.addAssignee('plan-1', { userId: 'leader-2', role: 'LEAD' } as never),
    ).rejects.toMatchObject({ status: 409 });
    expect(mockedRepo.addAssignee).not.toHaveBeenCalled();
  });
});

describe('scheduleService.createSchedulePlan — max 1 LEAD/plan', () => {
  it('rejects creating a plan with 2 assignees having role LEAD', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.taskExists.mockResolvedValue({ taskId: 'task-1' } as never);
    mockedRepo.findUserById.mockResolvedValue(fakeUser({ role: 'LEADER' }) as never);

    await expect(
      scheduleService.createSchedulePlan(
        {
          orderId: 'ord-1',
          taskId: 'task-1',
          startTime: new Date(),
          assignees: [
            { userId: 'leader-1', role: 'LEAD' },
            { userId: 'leader-2', role: 'LEAD' },
          ],
        } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });
});

describe('scheduleService.checkIn / checkOut', () => {
  const leader: Actor = { id: 'leader-1', role: 'LEADER' };
  const technical: Actor = { id: 'tech-1', role: 'TECHNICAL' };

  it('forbids checking in on behalf of someone else', async () => {
    await expect(scheduleService.checkIn('plan-1', 'someone-else', leader)).rejects.toMatchObject({ status: 403 });
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it('throws 404 when the user is not an assignee of this plan', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'CONFIRMED' }, []) as never);
    await expect(scheduleService.checkIn('plan-1', 'leader-1', leader)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects check-out when the assignee never checked in', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'CONFIRMED' }, [fakeAssignee({ attendance: null })]) as never,
    );

    await expect(scheduleService.checkOut('plan-1', 'leader-1', leader)).rejects.toMatchObject({ status: 400 });
    expect(mockedRepo.checkOut).not.toHaveBeenCalled();
  });

  it('rejects a second check-in', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'CONFIRMED' }, [
        fakeAssignee({ attendance: { checkInAt: new Date(), checkOutAt: null } }),
      ]) as never,
    );

    await expect(scheduleService.checkIn('plan-1', 'leader-1', leader)).rejects.toMatchObject({ status: 400 });
    expect(mockedRepo.checkIn).not.toHaveBeenCalled();
  });

  it('check-in by the LEAD assignee moves the plan to IN_PROGRESS (docs/api/more-require.md mục (ae))', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'CONFIRMED' }, [fakeAssignee({ assigneeId: 'assignee-1', attendance: null })]) as never,
    );
    mockedRepo.checkIn.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);

    await scheduleService.checkIn('plan-1', 'leader-1', leader);
    expect(mockedRepo.checkIn).toHaveBeenCalledWith('assignee-1', undefined);
    expect(mockedRepo.updateStatus).toHaveBeenCalledWith('plan-1', 'IN_PROGRESS', undefined, undefined);
  });

  it('check-in by a TECHNICAL assignee only records attendance, does not touch status', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'CONFIRMED' }, [
        fakeAssignee({ assigneeId: 'assignee-2', userId: 'tech-1', role: 'TECHNICAL', attendance: null }),
      ]) as never,
    );
    mockedRepo.checkIn.mockResolvedValue({} as never);

    await scheduleService.checkIn('plan-1', 'tech-1', technical);
    expect(mockedRepo.checkIn).toHaveBeenCalledWith('assignee-2', undefined);
    expect(mockedRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('check-in forwards an optional checkInEvidenceId to the repository (ảnh minh chứng lúc bắt đầu)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'CONFIRMED' }, [fakeAssignee({ assigneeId: 'assignee-1', attendance: null })]) as never,
    );
    mockedRepo.checkIn.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);

    await scheduleService.checkIn('plan-1', 'leader-1', leader, 'evidence-1');
    expect(mockedRepo.checkIn).toHaveBeenCalledWith('assignee-1', 'evidence-1');
  });

  it('check-in by the LEAD assignee does NOT revive a CANCELLED plan', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'CANCELLED' }, [fakeAssignee({ assigneeId: 'assignee-1', attendance: null })]) as never,
    );
    mockedRepo.checkIn.mockResolvedValue({} as never);

    await scheduleService.checkIn('plan-1', 'leader-1', leader);
    expect(mockedRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('check-out by the LEAD assignee moves the plan to COMPLETED (docs/api/more-require.md mục (ae))', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'IN_PROGRESS' }, [
        fakeAssignee({ assigneeId: 'assignee-1', attendance: { checkInAt: new Date(), checkOutAt: null } }),
      ]) as never,
    );
    mockedRepo.checkOut.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);

    await scheduleService.checkOut('plan-1', 'leader-1', leader);
    expect(mockedRepo.checkOut).toHaveBeenCalledWith('assignee-1');
    expect(mockedRepo.updateStatus).toHaveBeenCalledWith('plan-1', 'COMPLETED', undefined, undefined);
  });
});

describe('scheduleService.attachEvidence — gắn evidenceId độc lập với status (docs/api/more-require.md mục (ag))', () => {
  const technical: Actor = { id: 'tech-1', role: 'TECHNICAL' };
  const outsider: Actor = { id: 'someone-else', role: 'TECHNICAL' };

  it('forbids a user who is not an assignee of this plan', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'IN_PROGRESS' }, [fakeAssignee({ userId: 'leader-1' })]) as never,
    );

    await expect(scheduleService.attachEvidence('plan-1', 'evidence-1', outsider)).rejects.toMatchObject({
      status: 403,
    });
    expect(mockedRepo.attachEvidence).not.toHaveBeenCalled();
  });

  it('allows any assignee (LEAD or TECHNICAL) to attach evidence regardless of status', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'COMPLETED' }, [
        fakeAssignee({ userId: 'leader-1', role: 'LEAD' }),
        fakeAssignee({ assigneeId: 'assignee-2', userId: 'tech-1', role: 'TECHNICAL' }),
      ]) as never,
    );
    mockedRepo.attachEvidence.mockResolvedValue({} as never);

    await scheduleService.attachEvidence('plan-1', 'evidence-1', technical);
    expect(mockedRepo.attachEvidence).toHaveBeenCalledWith('plan-1', 'evidence-1');
  });
});

describe('HTTP routes — role permission matrix', () => {
  it('GET /api/v1/schedule-plans is reachable by any authenticated role (e.g. TECHNICAL)', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakePlan()], totalItems: 1 } as never);

    const res = await request(app).get('/api/v1/schedule-plans').set('Authorization', authHeader('TECHNICAL'));
    expect(res.status).toBe(200);
  });

  it('POST /api/v1/schedule-plans is forbidden for LEADER (Manager-only action)', async () => {
    const res = await request(app)
      .post('/api/v1/schedule-plans')
      .set('Authorization', authHeader('LEADER'))
      .send({ orderId: 'ord-1', taskId: 'task-1', startTime: '2026-08-14T07:00:00Z', assignees: [] });

    expect(res.status).toBe(403);
  });

  it('POST /api/v1/schedule-plans/:planId/assignees/:userId/check-in is forbidden for MANAGER (field-staff-only action)', async () => {
    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/leader-1/check-in')
      .set('Authorization', authHeader('MANAGER'));

    expect(res.status).toBe(403);
  });

  it('PATCH /api/v1/schedule-plans/:planId/evidence is forbidden for MANAGER (staff-only action, docs/api/more-require.md mục (ag))', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/plan-1/evidence')
      .set('Authorization', authHeader('MANAGER'))
      .send({ evidenceId: 'evidence-1' });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/v1/schedule-plans/:planId/evidence rejects a missing evidenceId with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/plan-1/evidence')
      .set('Authorization', authHeader('LEADER'))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/v1/schedule-plans/:planId/status is forbidden for ADMIN (read-only role)', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/plan-1/status')
      .set('Authorization', authHeader('ADMIN'))
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/v1/schedule-plans/:planId/status is forbidden for LEADER (Manager-only, docs/api/more-require.md mục (ae))', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/plan-1/status')
      .set('Authorization', authHeader('LEADER'))
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/v1/schedule-plans/:planId/status rejects IN_PROGRESS/COMPLETED with 400 — no longer valid input (docs/api/more-require.md mục (ae))', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/plan-1/status')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid endTime <= startTime with 400', async () => {
    const res = await request(app)
      .post('/api/v1/schedule-plans')
      .set('Authorization', authHeader('MANAGER'))
      .send({
        orderId: 'ord-1',
        taskId: 'task-1',
        startTime: '2026-08-14T10:00:00Z',
        endTime: '2026-08-14T09:00:00Z',
        assignees: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/v1/schedule-plans/batch/status', () => {
  it('is registered before /:planId/status — "batch" is never swallowed as a planId', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ planId: 'plan-1', status: 'PENDING' }) as never);
    mockedRepo.updateStatusBatch.mockResolvedValue([fakePlan({ planId: 'plan-1', status: 'CANCELLED' })] as never);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/batch/status')
      .set('Authorization', authHeader('MANAGER'))
      .send({ planIds: ['plan-1'], status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(mockedRepo.updateStatusBatch).toHaveBeenCalledWith(['plan-1'], 'CANCELLED', undefined);
  });

  it('cancels multiple plans in one call', async () => {
    mockedRepo.findById.mockImplementation((planId: string) =>
      Promise.resolve(fakePlan({ planId, status: 'CONFIRMED' }) as never),
    );
    mockedRepo.updateStatusBatch.mockResolvedValue([
      fakePlan({ planId: 'plan-1', status: 'CANCELLED' }),
      fakePlan({ planId: 'plan-2', status: 'CANCELLED' }),
    ] as never);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/batch/status')
      .set('Authorization', authHeader('MANAGER'))
      .send({ planIds: ['plan-1', 'plan-2'], status: 'CANCELLED', notes: 'Hủy theo yêu cầu khách' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(mockedRepo.updateStatusBatch).toHaveBeenCalledWith(
      ['plan-1', 'plan-2'],
      'CANCELLED',
      'Hủy theo yêu cầu khách',
    );
  });

  it('rejects cancelling a plan that is already COMPLETED with 400, and does not update any plan', async () => {
    mockedRepo.findById.mockImplementation((planId: string) =>
      Promise.resolve(fakePlan({ planId, status: planId === 'plan-2' ? 'COMPLETED' : 'PENDING' }) as never),
    );

    const res = await request(app)
      .patch('/api/v1/schedule-plans/batch/status')
      .set('Authorization', authHeader('MANAGER'))
      .send({ planIds: ['plan-1', 'plan-2'], status: 'CANCELLED' });

    expect(res.status).toBe(400);
    expect(mockedRepo.updateStatusBatch).not.toHaveBeenCalled();
  });

  it('returns 404 when one of the planIds does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/batch/status')
      .set('Authorization', authHeader('MANAGER'))
      .send({ planIds: ['ghost'], status: 'CANCELLED' });

    expect(res.status).toBe(404);
  });

  it('rejects an empty planIds array with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/batch/status')
      .set('Authorization', authHeader('MANAGER'))
      .send({ planIds: [], status: 'CANCELLED' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a status outside CONFIRMED/CANCELLED with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/batch/status')
      .set('Authorization', authHeader('MANAGER'))
      .send({ planIds: ['plan-1'], status: 'COMPLETED' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('is forbidden for non-Manager roles', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/batch/status')
      .set('Authorization', authHeader('LEADER'))
      .send({ planIds: ['plan-1'], status: 'CANCELLED' });

    expect(res.status).toBe(403);
  });
});
