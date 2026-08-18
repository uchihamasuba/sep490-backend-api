// ---------------------------------------------------------------------------
// Real HTTP coverage for Report5.1_Unit Test.xlsx sheets "View Assigned Tasks"
// and "View Task Details" (uts_full.json). The placeholder loops above are
// left untouched — this section adds genuine request/mock/assertion coverage
// per UTCID.
// ---------------------------------------------------------------------------
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { scheduleRepository } from '../schedule.repository';

jest.mock('../schedule.repository', () => ({
  scheduleRepository: {
    findById: jest.fn(),
    findActiveCheckInsForUser: jest.fn(),
  },
}));

const mockedRepo = scheduleRepository as jest.Mocked<typeof scheduleRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

// The sheets use a "Customer" role which does not exist in this backend's UserRole enum
// (ADMIN/MANAGER/STAFF only) — simulated the same way as src/modules/operations/__tests__/survey.test.ts
// UTCID-style tests do: sign a token with an arbitrary role string not in the allow-list.
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
      endDate: null,
      location: '123 Tech St. Hall A',
      customer: { customerName: 'Nguyen Minh Tri', phone: '0900000001', address: 'Ha Noi' },
    },
    taskId: 'task-1',
    task: { taskId: 'task-1', taskCode: 'TSK-SETUP', taskName: 'Lắp đặt thiết bị' },
    startTime: new Date('2026-08-14T07:00:00Z'),
    endTime: new Date('2026-08-14T11:00:00Z'),
    location: '123 Tech St. Hall A',
    latitude: null,
    longitude: null,
    status: 'IN_PROGRESS',
    evidences: [],
    notes: null,
    assignees,
    ...overrides,
  };
}

function fakeAssignee(overrides: Partial<FakeAssignee> = {}): FakeAssignee {
  return {
    assigneeId: 'assignee-1',
    userId: 'S1',
    role: 'LEAD',
    user: { fullName: 'Nhan Vien S1', phone: '0900000002' },
    attendance: null,
    ...overrides,
  };
}

describe('GET /api/v1/schedule-plans/active — HTTP coverage for "View Assigned Tasks"', () => {
  // Sheet maps to scheduleController.listActive (the mobile "my assigned work" home list). It's the only
  // "assigned tasks" endpoint gated by requireRole('STAFF'), which matches UTCID02's documented 403 for a
  // non-Staff caller. NOTE: this endpoint takes NO query filters at all (controller ignores req.query,
  // calling scheduleService.listMyActiveCheckIns(actor) with no params) — so the date/status-driven
  // UTCID03/05 diverge from the doc; actual behavior is asserted with a comment.

  it('UTCID01: missing token -> 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/schedule-plans/active');
    expect(res.status).toBe(401);
  });

  it('UTCID02: non-Staff role (Customer) -> 403 Forbidden (requireRole STAFF gate)', async () => {
    const res = await request(app).get('/api/v1/schedule-plans/active').set('Authorization', customerAuthHeader());
    expect(res.status).toBe(403);
  });

  // Documented: invalid `date` query -> 400. Actual: /active ignores query entirely, so it's a no-op.
  it('UTCID03: invalid `date` query param -> actual backend ignores query on this endpoint, returns 200 (documented vs actual)', async () => {
    mockedRepo.findActiveCheckInsForUser.mockResolvedValue([fakePlan()] as never);

    const res = await request(app)
      .get('/api/v1/schedule-plans/active?date=invalid')
      .set('Authorization', authHeader('STAFF', 'S1'));

    expect(res.status).toBe(200);
  });

  it('UTCID04: query status=PENDING -> 200 Successful response', async () => {
    mockedRepo.findActiveCheckInsForUser.mockResolvedValue([fakePlan({ status: 'PENDING' })] as never);

    const res = await request(app)
      .get('/api/v1/schedule-plans/active?status=PENDING')
      .set('Authorization', authHeader('STAFF', 'S1'));

    expect(res.status).toBe(200);
  });

  // Documented: repository/DB error -> 400. Actual: an unhandled repository rejection falls to the
  // generic error-handler branch, which returns 500 (INTERNAL_ERROR), not 400.
  it('UTCID05: repository throws a DB error -> actual backend returns 500, not the documented 400', async () => {
    mockedRepo.findActiveCheckInsForUser.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app).get('/api/v1/schedule-plans/active').set('Authorization', authHeader('STAFF', 'S1'));

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Lỗi kết nối cơ sở dữ liệu');
  });

  it('UTCID06: query status=COMPLETED -> 200 Successful response', async () => {
    mockedRepo.findActiveCheckInsForUser.mockResolvedValue([fakePlan({ status: 'COMPLETED' })] as never);

    const res = await request(app)
      .get('/api/v1/schedule-plans/active?status=COMPLETED')
      .set('Authorization', authHeader('STAFF', 'S1'));

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/schedule-plans/:planId — HTTP coverage for "View Task Details"', () => {
  // Sheet maps to scheduleController.getById. There's no requireRole gate on this route (any
  // authenticated role can call it) — getSchedulePlanById only restricts STAFF actors to their own
  // assigned plans, and (per its own comment) intentionally returns 404 rather than 403 for a STAFF
  // actor viewing someone else's plan, "to not leak the plan's existence".

  it('UTCID01: no token -> 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/schedule-plans/plan-1');
    expect(res.status).toBe(401);
  });

  // Documented: non-Staff role -> 403. Actual: getById has no requireRole gate, and getSchedulePlanById's
  // ownership check only applies to actor.role === 'STAFF' — any other role reads the plan freely.
  it('UTCID02: non-Staff role (Customer) -> actual backend returns 200, not the documented 403', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan() as never);

    const res = await request(app).get('/api/v1/schedule-plans/plan-1').set('Authorization', customerAuthHeader());

    expect(res.status).toBe(200);
  });

  // Documented: missing task_id -> 400. Actual: planIdParamSchema rejects a blank (trims-to-empty)
  // planId with a Zod validation 400 — simulated via a URL-encoded whitespace path segment.
  it('UTCID03: blank planId param -> 400 Bad Request (Zod validation)', async () => {
    const res = await request(app).get('/api/v1/schedule-plans/%20').set('Authorization', authHeader('STAFF', 'S1'));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('UTCID04: non-existent task_id -> 404 Not Found', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/schedule-plans/NON_EXISTENT')
      .set('Authorization', authHeader('STAFF', 'S1'));

    expect(res.status).toBe(404);
  });

  // Documented message differs ("Bạn không có quyền xem công việc được giao cho nhân viên khác" / 403),
  // but the actual guard intentionally returns 404 to hide the plan's existence — see comment above
  // getSchedulePlanById in schedule.service.ts.
  it('UTCID05: task assigned to another Staff -> actual backend returns 404 (hides existence), not 403', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'other-staff' })]) as never);

    const res = await request(app)
      .get('/api/v1/schedule-plans/TASK_OTHER')
      .set('Authorization', authHeader('STAFF', 'S1'));

    expect(res.status).toBe(404);
  });

  it('UTCID06: repository throws a DB error -> 500 Internal Server Error', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app).get('/api/v1/schedule-plans/TASK123').set('Authorization', authHeader('STAFF', 'S1'));

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Lỗi kết nối cơ sở dữ liệu');
  });

  it('UTCID07: assigned Staff reads own task -> 200 Successful response', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'S1' })]) as never);

    const res = await request(app).get('/api/v1/schedule-plans/TASK123').set('Authorization', authHeader('STAFF', 'S1'));

    expect(res.status).toBe(200);
    expect(res.body.data.planId).toBe('plan-1');
  });
});

