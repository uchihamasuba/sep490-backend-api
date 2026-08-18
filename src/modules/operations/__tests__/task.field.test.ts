// ---------------------------------------------------------------------------
// Real HTTP coverage for Report5.1_Unit Test.xlsx sheets "Update Field Progress",
// "Check-in Attendance", "Check-out Attendance", "Confirm Work Completion"
// (uts_full.json). The placeholder loops above are left untouched — this
// section adds genuine request/mock/assertion coverage per UTCID.
//
// Endpoint mapping (schedule.routes.ts):
//   - Check-in Attendance  -> POST /schedule-plans/:planId/assignees/:userId/check-in
//   - Check-out Attendance -> POST /schedule-plans/:planId/assignees/:userId/check-out
//   - Confirm Work Completion & Update Field Progress -> PATCH /schedule-plans/:planId/evidence
//     (scheduleController.attachEvidence). Neither of these two sheets has a dedicated backend
//     endpoint (no completion-percentage or photo/signature-signoff route exists) — attachEvidence
//     is the closest real analog: STAFF-only, same-assignee-only, and centered on uploading proof
//     photos for the plan, which both sheets describe in different words ("photo/signature" for
//     completion, "GPS + progress %" for field progress). Divergences from the documented behavior
//     are called out per test.
// ---------------------------------------------------------------------------
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { scheduleRepository } from '../schedule.repository';

jest.mock('../schedule.repository', () => ({
  scheduleRepository: {
    findById: jest.fn(),
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    updateStatus: jest.fn(),
    promoteOrderToInProgress: jest.fn(),
    attachEvidence: jest.fn(),
  },
}));

const mockedRepo = scheduleRepository as jest.Mocked<typeof scheduleRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

// The sheets use a "Customer" role that doesn't exist in this backend's UserRole enum
// (ADMIN/MANAGER/STAFF only) — simulated the same way src/modules/operations/__tests__/survey.test.ts
// does: sign a token with a role string outside the allow-list.
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
      latitude: null,
      longitude: null,
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

describe('POST /api/v1/schedule-plans/:planId/assignees/:userId/check-in — HTTP coverage for "Check-in Attendance"', () => {
  it('UTCID01: no token -> 401 Unauthorized', async () => {
    const res = await request(app).post('/api/v1/schedule-plans/plan-1/assignees/S1/check-in').send({});
    expect(res.status).toBe(401);
  });

  it('UTCID02: non-Staff role (Customer) -> 403 Forbidden (requireRole STAFF gate)', async () => {
    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-in')
      .set('Authorization', customerAuthHeader())
      .send({});
    expect(res.status).toBe(403);
  });

  // Actual message differs ("Không tìm thấy nhân sự được phân công trong kế hoạch này" vs the doc's
  // "no shift assigned today"), but both represent "this Staff has nothing to check in to" -> 404.
  it('UTCID03: Staff has no shift assigned today -> 404 Not Found (message differs from doc)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, []) as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/STAFF_OFF_DAY/check-in')
      .set('Authorization', authHeader('STAFF', 'STAFF_OFF_DAY'))
      .send({});

    expect(res.status).toBe(404);
  });

  it('UTCID04: assignee already checked in -> 400 Bad Request', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({}, [
        fakeAssignee({ userId: 'ALREADY_CHECKED', attendance: { checkInAt: new Date(), checkOutAt: null } }),
      ]) as never,
    );

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/ALREADY_CHECKED/check-in')
      .set('Authorization', authHeader('STAFF', 'ALREADY_CHECKED'))
      .send({});

    expect(res.status).toBe(400);
  });

  // Documented: an out-of-window check-in time -> 400. Actual: the backend has no time-of-day
  // validation for check-in at all (checkInBodySchema has no `time` field), so it succeeds.
  it('UTCID05: body { time: "23:00" } -> actual backend has no time-window validation, returns 200 (documented vs actual)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ attendance: null })]) as never);
    mockedRepo.checkIn.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);
    mockedRepo.promoteOrderToInProgress.mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-in')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ time: '23:00' });

    expect(res.status).toBe(200);
  });

  // Documented: missing GPS/photo -> 400. Actual: checkInBodySchema's checkInEvidenceId/latitude/
  // longitude are all optional, so omitting them (or sending unrelated `location`/`photo` keys) does
  // not fail validation.
  it('UTCID06: body { location: null, photo: null } -> actual backend has no required-GPS/photo validation, returns 200 (documented vs actual)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ attendance: null })]) as never);
    mockedRepo.checkIn.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);
    mockedRepo.promoteOrderToInProgress.mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-in')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ location: null, photo: null });

    expect(res.status).toBe(200);
  });

  it('UTCID07: check-in location outside allowed radius -> 400 Bad Request (real distance guard)', async () => {
    const plan = fakePlan({}, [fakeAssignee({ attendance: null })]);
    (plan.order as { latitude: number | null }).latitude = 21.0;
    (plan.order as { longitude: number | null }).longitude = 105.8;
    mockedRepo.findById.mockResolvedValue(plan as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-in')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ latitude: 22.5, longitude: 107.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Vị trí check-in nằm ngoài phạm vi cho phép');
  });

  it('UTCID08: repository throws a DB error -> 500 Internal Server Error', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-in')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({});

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Lỗi kết nối cơ sở dữ liệu');
  });

  it('UTCID09: valid check-in -> 200 Successful response', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ attendance: null })]) as never);
    mockedRepo.checkIn.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);
    mockedRepo.promoteOrderToInProgress.mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-in')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ location: 'Valid', photo: 'Valid' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/schedule-plans/:planId/assignees/:userId/check-out — HTTP coverage for "Check-out Attendance"', () => {
  it('UTCID01: no token -> 401 Unauthorized', async () => {
    const res = await request(app).post('/api/v1/schedule-plans/plan-1/assignees/S1/check-out').send({});
    expect(res.status).toBe(401);
  });

  it('UTCID02: non-Staff role (Customer) -> 403 Forbidden (requireRole STAFF gate)', async () => {
    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-out')
      .set('Authorization', customerAuthHeader())
      .send({});
    expect(res.status).toBe(403);
  });

  it('UTCID03: Staff has no shift assigned today -> 404 Not Found (message differs from doc)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, []) as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/STAFF_OFF_DAY/check-out')
      .set('Authorization', authHeader('STAFF', 'STAFF_OFF_DAY'))
      .send({});

    expect(res.status).toBe(404);
  });

  it('UTCID04: not checked in yet -> 400 Bad Request (real message match)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({}, [fakeAssignee({ userId: 'NOT_CHECKED_IN_YET', attendance: null })]) as never,
    );

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/NOT_CHECKED_IN_YET/check-out')
      .set('Authorization', authHeader('STAFF', 'NOT_CHECKED_IN_YET'))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Chưa check-in, không thể check-out');
  });

  it('UTCID05: already checked out -> 400 Bad Request (real message match)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({}, [
        fakeAssignee({
          userId: 'ALREADY_CHECKED_OUT',
          attendance: { checkInAt: new Date(), checkOutAt: new Date() },
        }),
      ]) as never,
    );

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/ALREADY_CHECKED_OUT/check-out')
      .set('Authorization', authHeader('STAFF', 'ALREADY_CHECKED_OUT'))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Đã check-out trước đó');
  });

  // Documented: missing GPS/photo -> 400. Actual: checkOutBodySchema only has optional latitude/
  // longitude, no photo field and no required-ness — succeeds.
  it('UTCID06: body { location: null, photo: null } -> actual backend has no required-GPS/photo validation, returns 200 (documented vs actual)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({}, [fakeAssignee({ attendance: { checkInAt: new Date(), checkOutAt: null } })]) as never,
    );
    mockedRepo.checkOut.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-out')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ location: null, photo: null });

    expect(res.status).toBe(200);
  });

  // Documented: out-of-range location -> 400. Actual: unlike check-in, checkOut performs NO distance
  // validation at all (no order-coordinate comparison in scheduleService.checkOut) — succeeds.
  it('UTCID07: body { location: { distance: "5km" } } -> actual backend has no distance guard on check-out, returns 200 (documented vs actual)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({}, [fakeAssignee({ attendance: { checkInAt: new Date(), checkOutAt: null } })]) as never,
    );
    mockedRepo.checkOut.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-out')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ location: { distance: '5km' } });

    expect(res.status).toBe(200);
  });

  it('UTCID08: repository throws a DB error -> 500 Internal Server Error', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-out')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({});

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Lỗi kết nối cơ sở dữ liệu');
  });

  it('UTCID09: valid check-out -> 200 Successful response', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({}, [fakeAssignee({ attendance: { checkInAt: new Date(), checkOutAt: null } })]) as never,
    );
    mockedRepo.checkOut.mockResolvedValue({} as never);
    mockedRepo.updateStatus.mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/v1/schedule-plans/plan-1/assignees/S1/check-out')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ location: 'Valid', photo: 'Valid' });

    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/v1/schedule-plans/:planId/evidence — HTTP coverage for "Confirm Work Completion"', () => {
  it('UTCID01: no token -> 401 Unauthorized', async () => {
    const res = await request(app).patch('/api/v1/schedule-plans/T1/evidence').send({});
    expect(res.status).toBe(401);
  });

  it('UTCID02: non-Staff role (Customer) -> 403 Forbidden (requireRole STAFF gate)', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/T1/evidence')
      .set('Authorization', customerAuthHeader())
      .send({ evidenceId: 'ev-1' });
    expect(res.status).toBe(403);
  });

  it('UTCID03: non-existent task_id -> 404 Not Found', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/NON_EXISTENT/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ evidenceId: 'ev-1' });

    expect(res.status).toBe(404);
  });

  it('UTCID04: task belongs to another Staff (not an assignee) -> 403 Forbidden (real message match)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'other-staff' })]) as never);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/T_OTHER/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ evidenceId: 'ev-1' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Chỉ nhân sự được phân công vào kế hoạch này mới được gắn ảnh minh chứng');
  });

  // Documented: a PENDING (not-yet-started) task cannot be confirmed complete -> 400. Actual:
  // attachEvidence intentionally has NO status gate at all — see the comment above
  // scheduleRouter.patch('/:planId/evidence') ("Không bắt buộc, không gắn điều kiện status nào").
  it('UTCID05: task still PENDING -> actual backend has no status gate, returns 200 (documented vs actual)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'PENDING' }, [fakeAssignee({ userId: 'S1' })]) as never,
    );
    mockedRepo.attachEvidence.mockResolvedValue({} as never);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/T_PENDING/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ evidenceId: 'ev-1' });

    expect(res.status).toBe(200);
  });

  // Documented: a COMPLETED/CANCELLED task cannot be confirmed again -> 400. Actual: same no-status-gate
  // behavior as UTCID05 above.
  it('UTCID06: task already COMPLETED -> actual backend has no status gate, returns 200 (documented vs actual)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'COMPLETED' }, [fakeAssignee({ userId: 'S1' })]) as never,
    );
    mockedRepo.attachEvidence.mockResolvedValue({} as never);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/T_COMPLETED/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ evidenceId: 'ev-1' });

    expect(res.status).toBe(200);
  });

  it('UTCID07: missing photo/signature (no evidenceId) -> 400 Bad Request (real validation match)', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/T1/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ photo: null, signature: null });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('UTCID08: repository throws a DB error -> 500 Internal Server Error', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .patch('/api/v1/schedule-plans/T1/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ evidenceId: 'ev-1' });

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Lỗi kết nối cơ sở dữ liệu');
  });

  // Documented body is { photo: 'url', signature: 'url' } — adapted to also carry `evidenceId` since
  // attachEvidenceBodySchema requires at least one evidenceId/evidenceIds entry (the actual contract
  // has no separate photo/signature fields; the "proof" is uploaded and referenced by evidenceId).
  it('UTCID09: photo + signature evidence provided -> 200 Successful response', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'S1' })]) as never);
    mockedRepo.attachEvidence.mockResolvedValue({} as never);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/T1/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ photo: 'url', signature: 'url', evidenceId: 'evidence-photo-signature' });

    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/v1/schedule-plans/:planId/evidence — HTTP coverage for "Update Field Progress"', () => {
  it('UTCID01: no token -> 401 Unauthorized', async () => {
    const res = await request(app).patch('/api/v1/schedule-plans/T1/evidence').send({});
    expect(res.status).toBe(401);
  });

  it('UTCID02: non-Staff role (Customer) -> 403 Forbidden (requireRole STAFF gate)', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/T1/evidence')
      .set('Authorization', customerAuthHeader())
      .send({ evidenceId: 'ev-1' });
    expect(res.status).toBe(403);
  });

  it('UTCID03: non-existent task_id -> 404 Not Found', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/NON_EXISTENT/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ evidenceId: 'ev-1' });

    expect(res.status).toBe(404);
  });

  it('UTCID04: task belongs to another Staff (not an assignee) -> 403 Forbidden (real message match)', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'other-staff' })]) as never);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/T_OTHER/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ evidenceId: 'ev-1' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Chỉ nhân sự được phân công vào kế hoạch này mới được gắn ảnh minh chứng');
  });

  // Documented: a COMPLETED/CANCELLED task's progress cannot be updated -> 400. Actual: attachEvidence
  // has no status gate (see comment in the "Confirm Work Completion" block above) — succeeds.
  it('UTCID05: task already COMPLETED -> actual backend has no status gate, returns 200 (documented vs actual)', async () => {
    mockedRepo.findById.mockResolvedValue(
      fakePlan({ status: 'COMPLETED' }, [fakeAssignee({ userId: 'S1' })]) as never,
    );
    mockedRepo.attachEvidence.mockResolvedValue({} as never);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/T_COMPLETED/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ evidenceId: 'ev-1' });

    expect(res.status).toBe(200);
  });

  // Documented: progress=150 (outside 0-100) -> 400 "invalid percentage". Actual: attachEvidenceBodySchema
  // has no `progress` field at all; the 400 that actually fires is a different validation failure
  // (missing evidenceId/evidenceIds) — same status code, different real reason.
  it('UTCID06: body { progress: 150 } -> 400 Bad Request, but via missing-evidenceId validation, not percentage range (documented vs actual)', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/T1/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ progress: 150 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Documented: missing GPS location -> 400. Actual: same missing-evidenceId validation failure as
  // UTCID06 — attachEvidenceBodySchema has no location field to validate at all.
  it('UTCID07: body { location: null } -> 400 Bad Request, but via missing-evidenceId validation, not GPS (documented vs actual)', async () => {
    const res = await request(app)
      .patch('/api/v1/schedule-plans/T1/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ location: null });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('UTCID08: repository throws a DB error -> 500 Internal Server Error', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));

    const res = await request(app)
      .patch('/api/v1/schedule-plans/T1/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ evidenceId: 'ev-1' });

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Lỗi kết nối cơ sở dữ liệu');
  });

  // Documented body is { progress: 50, location: {...} } — adapted to also carry `evidenceId` since
  // attachEvidenceBodySchema requires at least one evidenceId/evidenceIds entry (the actual contract has
  // no progress/location fields; field-progress proof is uploaded and referenced by evidenceId).
  it('UTCID09: progress + location provided -> 200 Successful response', async () => {
    mockedRepo.findById.mockResolvedValue(fakePlan({}, [fakeAssignee({ userId: 'S1' })]) as never);
    mockedRepo.attachEvidence.mockResolvedValue({} as never);

    const res = await request(app)
      .patch('/api/v1/schedule-plans/T1/evidence')
      .set('Authorization', authHeader('STAFF', 'S1'))
      .send({ progress: 50, location: { lat: 21.0, lng: 105.8 }, evidenceId: 'evidence-progress' });

    expect(res.status).toBe(200);
  });
});

