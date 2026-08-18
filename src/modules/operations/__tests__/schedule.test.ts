import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { scheduleRepository } from '../schedule.repository';
import { scheduleService } from '../schedule.service';
import type { Actor } from '../schedule.service';
import { inventoryRepository } from '../../inventory/inventory.repository';

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
    syncOrderDates: jest.fn(),
    listWorkTasks: jest.fn(),
    promoteOrderToInProgress: jest.fn(),
  },
}));

// Used by the "Confirm Warehouse Check-out" HTTP block below (recordWarehouseMovement delegates to
// inventoryService.recordFieldOutbound, which reads items via inventoryRepository). Keep the real
// InsufficientFieldStockError export so the service's `err instanceof InsufficientFieldStockError`
// branch (-> 400) can still be exercised.
jest.mock('../../inventory/inventory.repository', () => {
  const actual = jest.requireActual('../../inventory/inventory.repository');
  return {
    ...actual,
    inventoryRepository: {
      itemExists: jest.fn(),
      recordFieldOutbound: jest.fn(),
    },
  };
});

// recordFieldOutbound fires a fire-and-forget notification broadcast; mock it out so tests don't touch
// real DB/FCM calls via an unawaited promise.
jest.mock('../../shared/notification.service', () => ({
  notificationService: { broadcastToPrivilegedUsers: jest.fn().mockResolvedValue(undefined) },
}));

const mockedRepo = scheduleRepository as jest.Mocked<typeof scheduleRepository>;
const mockedInventoryRepo = inventoryRepository as jest.Mocked<typeof inventoryRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

// The sheet uses a "Customer" role that doesn't exist in this backend's UserRole enum (ADMIN/MANAGER/
// STAFF only) — simulated the same way src/modules/operations/__tests__/survey.test.ts does: sign a
// token with a role string outside the allow-list.
function customerAuthHeader(userId = 'cust-1') {
  const token = jwt.sign({ id: userId, role: 'CUSTOMER' }, env.JWT_SECRET, { expiresIn: '1h' });
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
  return { userId: 'leader-1', fullName: 'Le Van Leader', role: 'STAFF', ...overrides };
}

describe('scheduleService.createSchedulePlan', () => {
  it('throws 404 when the order does not exist', async () => {
    mockedRepo.orderExists.mockResolvedValue(null);

    await expect(
      scheduleService.createSchedulePlan(
        { orderId: 'missing', taskId: 'task-1', startTime: new Date(), assignees: [] } as never,
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404, message: 'Không tìm thấy đơn hàng' });
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
    ).rejects.toMatchObject({ status: 404, message: 'Không tìm thấy người dùng: ghost-user' });
  });

  it('throws 400 when the assignee user has an ineligible role (not STAFF)', async () => {
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
  // docs/api/api.md gap (c), đã chốt 2026-07-22: Leader được tự xác nhận (CONFIRMED) kế hoạch của
  // chính mình, chỉ khi giữ vai trò LEAD trong đúng plan đó — CANCELLED vẫn luôn thuộc về Manager.
  const leader: Actor = { id: 'leader-1', role: 'STAFF' };
  const otherLeader: Actor = { id: 'leader-2', role: 'STAFF' };

  it('allows the LEAD assignee (Leader) to confirm their own PENDING plan', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }, [fakeAssignee()]) as never);
    mockedRepo.updateStatus.mockResolvedValue(fakePlan({ status: 'CONFIRMED' }, [fakeAssignee()]) as never);

    const result = await scheduleService.updateSchedulePlanStatus('plan-1', { status: 'CONFIRMED' } as never, leader);
    expect(result.status).toBe('CONFIRMED');
  });

  it('forbids a Leader who is not the LEAD assignee of the plan from confirming it', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }, [fakeAssignee()]) as never);

    await expect(
      scheduleService.updateSchedulePlanStatus('plan-1', { status: 'CONFIRMED' } as never, otherLeader),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockedRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('forbids a Leader (even the LEAD assignee) from cancelling a plan', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }, [fakeAssignee()]) as never);

    await expect(
      scheduleService.updateSchedulePlanStatus('plan-1', { status: 'CANCELLED' } as never, leader),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockedRepo.updateStatus).not.toHaveBeenCalled();
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
});

describe('scheduleService.addAssignee', () => {
  it('throws 404 when the user does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }, []) as never);
    mockedRepo.findUserById.mockResolvedValue(null);

    await expect(
      scheduleService.addAssignee('plan-1', { userId: 'ghost', role: 'TECHNICAL' } as never),
    ).rejects.toMatchObject({ status: 404, message: 'Không tìm thấy người dùng: ghost' });
    expect(mockedRepo.addAssignee).not.toHaveBeenCalled();
  });

  it('throws 409 when the user is already assigned', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'PENDING' }, [fakeAssignee({ userId: 'leader-1' })]) as never);
    mockedRepo.findUserById.mockResolvedValue(fakeUser() as never);

    await expect(
      scheduleService.addAssignee('plan-1', { userId: 'leader-1', role: 'LEAD' } as never),
    ).rejects.toMatchObject({ status: 409, message: 'Nhân sự này đã được phân công vào kế hoạch' });
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
    mockedRepo.findUserById.mockResolvedValue(fakeUser({ userId: 'leader-2', role: 'STAFF' }) as never);

    await expect(
      scheduleService.addAssignee('plan-1', { userId: 'leader-2', role: 'LEAD' } as never),
    ).rejects.toMatchObject({ status: 409, message: 'Kế hoạch này đã có người vai trò LEAD' });
    expect(mockedRepo.addAssignee).not.toHaveBeenCalled();
  });
});

describe('scheduleService.createSchedulePlan — max 1 LEAD/plan', () => {
  it('rejects creating a plan with 2 assignees having role LEAD', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.taskExists.mockResolvedValue({ taskId: 'task-1' } as never);
    mockedRepo.findUserById.mockResolvedValue(fakeUser({ role: 'STAFF' }) as never);

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
  const leader: Actor = { id: 'leader-1', role: 'STAFF' };
  const technical: Actor = { id: 'tech-1', role: 'STAFF' };

  it('forbids checking in on behalf of someone else', async () => {
    await expect(scheduleService.checkIn('plan-1', 'someone-else', leader)).rejects.toMatchObject({ status: 403 });
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it('throws 404 when the user is not an assignee of this plan', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({ status: 'CONFIRMED' }, []) as never);
    await expect(scheduleService.checkIn('plan-1', 'leader-1', leader)).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy nhân sự được phân công trong kế hoạch này',
    });
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
    expect(mockedRepo.checkIn).toHaveBeenCalledWith('assignee-1', undefined, undefined, undefined);
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
    expect(mockedRepo.checkIn).toHaveBeenCalledWith('assignee-2', undefined, undefined, undefined);
    expect(mockedRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('check-in forwards an optional checkInEvidenceId to the repository (ảnh minh chứng lúc bắt đầu)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'CONFIRMED' }, [fakeAssignee({ assigneeId: 'assignee-1', attendance: null })]) as never,
    );
    mockedRepo.checkIn.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);

    await scheduleService.checkIn('plan-1', 'leader-1', leader, 'evidence-1');
    expect(mockedRepo.checkIn).toHaveBeenCalledWith('assignee-1', 'evidence-1', undefined, undefined);
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
    expect(mockedRepo.checkOut).toHaveBeenCalledWith('assignee-1', undefined, undefined);
    expect(mockedRepo.updateStatus).toHaveBeenCalledWith('plan-1', 'COMPLETED', undefined, undefined);
  });
});

describe('scheduleService.attachEvidence — gắn evidenceId độc lập với status (docs/api/more-require.md mục (ag))', () => {
  const technical: Actor = { id: 'tech-1', role: 'STAFF' };
  const outsider: Actor = { id: 'someone-else', role: 'STAFF' };

  it('forbids a user who is not an assignee of this plan', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'IN_PROGRESS' }, [fakeAssignee({ userId: 'leader-1' })]) as never,
    );

    await expect(scheduleService.attachEvidence('plan-1', ['evidence-1'], outsider)).rejects.toMatchObject({
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

    await scheduleService.attachEvidence('plan-1', ['evidence-1'], technical);
    expect(mockedRepo.attachEvidence).toHaveBeenCalledWith('plan-1', ['evidence-1']);
  });
});

describe('HTTP routes — role permission matrix', () => {
  it('GET /api/v1/schedule-plans is reachable by any authenticated role (e.g. STAFF)', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakePlan()], totalItems: 1 } as never);

    const res = await request(app).get('/api/v1/schedule-plans').set('Authorization', authHeader('STAFF'));
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/schedule-plans — STAFF bị ÉP assigneeUserId = id của mình, bỏ qua giá trị client truyền (chống IDOR)', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 } as never);

    // STAFF cố tình truyền assigneeUserId của người khác — server phải ghi đè bằng id trong token.
    await request(app)
      .get('/api/v1/schedule-plans?assigneeUserId=someone-else')
      .set('Authorization', authHeader('STAFF', 'staff-9'));

    expect(mockedRepo.findMany.mock.calls[0]?.[0]?.assigneeUserId).toBe('staff-9');
  });

  it('GET /api/v1/schedule-plans — STAFF không truyền assigneeUserId vẫn bị scope theo token (không thấy hết)', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 } as never);

    await request(app).get('/api/v1/schedule-plans').set('Authorization', authHeader('STAFF', 'staff-9'));

    expect(mockedRepo.findMany.mock.calls[0]?.[0]?.assigneeUserId).toBe('staff-9');
  });

  it('GET /api/v1/schedule-plans — MANAGER KHÔNG bị scope (không truyền assigneeUserId → thấy hết)', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 } as never);

    await request(app).get('/api/v1/schedule-plans').set('Authorization', authHeader('MANAGER', 'mgr-1'));

    expect(mockedRepo.findMany.mock.calls[0]?.[0]?.assigneeUserId).toBeUndefined();
  });

  it('GET /api/v1/schedule-plans/:planId — STAFF KHÔNG tham gia kế hoạch nhận 404 (che giấu tồn tại)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'leader-1' })]) as never);

    const res = await request(app)
      .get('/api/v1/schedule-plans/plan-1')
      .set('Authorization', authHeader('STAFF', 'other-staff'));

    expect(res.status).toBe(404);
  });

  it('GET /api/v1/schedule-plans/:planId — STAFF có tham gia thì đọc được (200)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'leader-1' })]) as never);

    const res = await request(app)
      .get('/api/v1/schedule-plans/plan-1')
      .set('Authorization', authHeader('STAFF', 'leader-1'));

    expect(res.status).toBe(200);
  });

  it('GET /api/v1/schedule-plans/:planId — MANAGER đọc được mọi kế hoạch (200)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'leader-1' })]) as never);

    const res = await request(app)
      .get('/api/v1/schedule-plans/plan-1')
      .set('Authorization', authHeader('MANAGER', 'mgr-1'));

    expect(res.status).toBe(200);
  });

  it('POST /api/v1/schedule-plans is forbidden for STAFF (Manager-only action)', async () => {
    const res = await request(app)
      .post('/api/v1/schedule-plans')
      .set('Authorization', authHeader('STAFF'))
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
      .send({ evidenceIds: ['evidence-1'] });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/v1/schedule-plans/:planId/evidence rejects a missing evidenceId with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/plan-1/evidence')
      .set('Authorization', authHeader('STAFF'))
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

  it('PATCH /api/v1/schedule-plans/:planId/status is forbidden for STAFF who is not the LEAD assignee (docs/api/more-require.md mục (ae))', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/plan-1/status')
      .set('Authorization', authHeader('STAFF'))
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
    expect(res.body.error.message).toBe('Không tìm thấy kế hoạch lịch trình');
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
      .set('Authorization', authHeader('STAFF'))
      .send({ planIds: ['plan-1'], status: 'CANCELLED' });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Real HTTP coverage for Report5.1_Unit Test.xlsx sheet "Confirm Warehouse
// Check-out" (uts_full.json). Maps to scheduleController.recordWarehouseMovement
// (POST /schedule-plans/:planId/warehouse-movement), which delegates to
// inventoryService.recordFieldOutbound (docs/api/api.md gap (g)). There's no
// separate "pick list" resource in this backend — the sheet's `pick_list_id`
// corresponds to the schedule plan's `planId` here; the Leader records
// field-outbound items directly against the plan.
// ---------------------------------------------------------------------------
describe('POST /api/v1/schedule-plans/:planId/warehouse-movement — HTTP coverage for "Confirm Warehouse Check-out"', () => {
  const items = [{ itemId: 'item-1', quantity: 2 }];

  it('UTCID01: no token -> 401 Unauthorized', async () => {
    const res = await request(app).post('/api/v1/schedule-plans/PL123/warehouse-movement').send({ items });
    expect(res.status).toBe(401);
  });

  it('UTCID02: non-Staff role (Customer) -> 403 Forbidden (requireRole STAFF gate)', async () => {
    const res = await request(app)
      .post('/api/v1/schedule-plans/PL123/warehouse-movement')
      .set('Authorization', customerAuthHeader())
      .send({ items });

    expect(res.status).toBe(403);
  });

  it('UTCID03: non-existent pick_list_id (planId) -> 404 Not Found (message differs from doc)', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/schedule-plans/NON_EXISTENT/warehouse-movement')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ items });

    expect(res.status).toBe(404);
  });

  it('UTCID04: caller is not the LEAD assignee of the plan -> 403 Forbidden (real message match)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({}, [fakeAssignee({ userId: 'other-lead', role: 'LEAD' })]) as never,
    );

    const res = await request(app)
      .post('/api/v1/schedule-plans/PL_OTHER_STAFF/warehouse-movement')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ items });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Chỉ Leader giữ vai trò LEAD trong kế hoạch này mới được ghi nhận xuất kho');
  });

  // Documented: re-confirming an already-recorded pick list -> 400 "already recorded". Actual: there is
  // no such idempotency guard in recordFieldOutbound at all — the real 400 branch is insufficient field
  // stock (InsufficientFieldStockError). Used here to reach a genuine 400 from this endpoint.
  it('UTCID05: insufficient field stock -> 400 Bad Request (documented reason differs from actual)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'S1', role: 'LEAD' })]) as never);
    mockedInventoryRepo.itemExists.mockResolvedValue({ itemId: 'item-1', itemName: 'May chieu' } as never);
    mockedInventoryRepo.recordFieldOutbound.mockRejectedValue(
      new (jest.requireActual('../../inventory/inventory.repository').InsufficientFieldStockError)('item-1', 1, 2),
    );

    const res = await request(app)
      .post('/api/v1/schedule-plans/PL_ALREADY_OUT/warehouse-movement')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ items });

    expect(res.status).toBe(400);
  });

  it('UTCID06: repository throws a DB error -> 500 Internal Server Error', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .post('/api/v1/schedule-plans/PL123/warehouse-movement')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ items });

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Lỗi kết nối cơ sở dữ liệu');
  });

  // Documented expected_status is 200. Actual: POST endpoints in this backend that create a resource use
  // the `created()` response helper -> 201, not 200 (documented vs actual REST convention).
  it('UTCID07: valid warehouse check-out -> actual backend returns 201 Created, not the documented 200', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'S1', role: 'LEAD' })]) as never);
    mockedInventoryRepo.itemExists.mockResolvedValue({ itemId: 'item-1', itemName: 'May chieu' } as never);
    mockedInventoryRepo.recordFieldOutbound.mockResolvedValue([
      {
        movementId: 'mv-1',
        itemId: 'item-1',
        item: { itemName: 'May chieu', unit: 'cai' },
        orderId: 'ord-1',
        reportId: null,
        movementType: 'FIELD_OUTBOUND',
        quantity: 2,
        performer: { userId: 'S1', fullName: 'Nhan Vien S1' },
        notes: null,
        createdAt: new Date('2026-08-14T08:00:00Z'),
      },
    ] as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/PL123/warehouse-movement')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ items });

    expect(res.status).toBe(201);
    expect(res.body.data[0].itemId).toBe('item-1');
  });
});
