import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { surveyRepository } from '../survey.repository';
import { surveyService } from '../survey.service';

jest.mock('../survey.repository', () => ({
  surveyRepository: {
    findMany: jest.fn(),
    countByStatusGlobal: jest.fn(),
    findById: jest.fn(),
    generateNextReportCode: jest.fn(),
    orderExists: jest.fn(),
    planExists: jest.fn(),
    create: jest.fn(),
    confirm: jest.fn(),
  },
}));

const mockedRepo = surveyRepository as jest.Mocked<typeof surveyRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeSurvey(overrides: Record<string, unknown> = {}) {
  return {
    surveyId: 'sur-1',
    reportCode: 'SUR-001',
    orderId: 'ord-1',
    order: { orderCode: 'ORD-001', eventName: 'Tech Summit 2026', customer: { customerName: 'Nguyen Minh Tri' } },
    planId: null,
    surveyDate: new Date('2026-07-25T02:00:00Z'),
    location: '123 Tech St. Hall A',
    area: null,
    length: null,
    width: null,
    entrance: null,
    siteConstraints: null,
    additionalRequests: null,
    proposedItems: null,
    notes: null,
    evidenceId: null,
    status: 'NEEDS_REVIEW',
    reporter: { userId: 'leader-1', fullName: 'Le Van Leader' },
    confirmer: null,
    confirmedAt: null,
    createdAt: new Date('2026-07-20T00:00:00Z'),
    updatedAt: new Date('2026-07-20T00:00:00Z'),
    ...overrides,
  };
}

describe('surveyService.createSurveyReport', () => {
  it('throws 404 when the order does not exist', async () => {
    mockedRepo.orderExists.mockResolvedValue(null);

    await expect(
      surveyService.createSurveyReport(
        { orderId: 'missing', surveyDate: new Date(), location: 'Hall A' } as never,
        'leader-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('creates the report with status NEEDS_REVIEW on success', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.generateNextReportCode.mockResolvedValue('SUR-001');
    mockedRepo.create.mockResolvedValue(fakeSurvey() as never);

    const result = await surveyService.createSurveyReport(
      { orderId: 'ord-1', surveyDate: new Date(), location: 'Hall A' } as never,
      'leader-1',
    );

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(mockedRepo.create).toHaveBeenCalledWith(expect.objectContaining({ reportedBy: 'leader-1' }));
  });
});

describe('surveyService.confirmSurveyReport', () => {
  it('confirms a NEEDS_REVIEW report', async () => {
    mockedRepo.findById.mockResolvedValue(fakeSurvey({ status: 'NEEDS_REVIEW' }) as never);
    mockedRepo.confirm.mockResolvedValue(
      fakeSurvey({ status: 'CONFIRMED', confirmer: { userId: 'mgr-1', fullName: 'Manager' }, confirmedAt: new Date() }) as never,
    );

    const result = await surveyService.confirmSurveyReport('sur-1', 'mgr-1');
    expect(result.status).toBe('CONFIRMED');
    expect(mockedRepo.confirm).toHaveBeenCalledWith('sur-1', 'mgr-1');
  });

  it('rejects confirming a report already in DRAFT (not yet submitted) with 400', async () => {
    mockedRepo.findById.mockResolvedValue(fakeSurvey({ status: 'DRAFT' }) as never);

    await expect(surveyService.confirmSurveyReport('sur-1', 'mgr-1')).rejects.toMatchObject({ status: 400 });
    expect(mockedRepo.confirm).not.toHaveBeenCalled();
  });

  it('rejects confirming an already-CONFIRMED report with 400', async () => {
    mockedRepo.findById.mockResolvedValue(fakeSurvey({ status: 'CONFIRMED' }) as never);

    await expect(surveyService.confirmSurveyReport('sur-1', 'mgr-1')).rejects.toMatchObject({ status: 400 });
  });
});

describe('HTTP routes — role permission matrix', () => {
  it('POST /api/v1/survey-reports succeeds for LEADER', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.generateNextReportCode.mockResolvedValue('SUR-001');
    mockedRepo.create.mockResolvedValue(fakeSurvey() as never);

    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('LEADER'))
      .send({ orderId: 'ord-1', surveyDate: '2026-07-25T02:00:00Z', location: 'Hall A' });

    expect(res.status).toBe(201);
  });

  it('POST /api/v1/survey-reports succeeds for MANAGER (web "+ Tạo báo cáo khảo sát" nút, yêu cầu 2026-07-22)', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.generateNextReportCode.mockResolvedValue('SUR-001');
    mockedRepo.create.mockResolvedValue(fakeSurvey() as never);

    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('MANAGER'))
      .send({ orderId: 'ord-1', surveyDate: '2026-07-25T02:00:00Z', location: 'Hall A' });

    expect(res.status).toBe(201);
  });

  it('POST /api/v1/survey-reports is forbidden for TECHNICAL', async () => {
    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('TECHNICAL'))
      .send({ orderId: 'ord-1', surveyDate: '2026-07-25T02:00:00Z', location: 'Hall A' });

    expect(res.status).toBe(403);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('POST /api/v1/survey-reports rejects an unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/v1/survey-reports')
      .send({ orderId: 'ord-1', surveyDate: '2026-07-25T02:00:00Z', location: 'Hall A' });

    expect(res.status).toBe(401);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a payload missing orderId with 400', async () => {
    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('LEADER'))
      .send({ surveyDate: '2026-07-25T02:00:00Z', location: 'Hall A' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a payload missing location with 400', async () => {
    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('LEADER'))
      .send({ orderId: 'ord-1', surveyDate: '2026-07-25T02:00:00Z' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('returns 404 when orderId does not exist (end-to-end through the route, not just the service)', async () => {
    mockedRepo.orderExists.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('LEADER'))
      .send({ orderId: 'missing-order', surveyDate: '2026-07-25T02:00:00Z', location: 'Hall A' });

    expect(res.status).toBe(404);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('creates the report with the full payload (all optional fields) and returns 201', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.planExists.mockResolvedValue({ planId: 'plan-1' });
    mockedRepo.generateNextReportCode.mockResolvedValue('SUR-002');
    mockedRepo.create.mockResolvedValue(
      fakeSurvey({
        reportCode: 'SUR-002',
        planId: 'plan-1',
        area: 50,
        length: 10,
        width: 5,
        entrance: 'Cổng chính',
        siteConstraints: 'Không có thang máy',
        additionalRequests: 'Cần thêm bàn ghế',
        proposedItems: 'Loa JBL, Đèn Beam',
        notes: 'Ghi chú khảo sát',
        evidenceId: 'evi-1',
      }) as never,
    );

    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('LEADER'))
      .send({
        orderId: 'ord-1',
        planId: 'plan-1',
        surveyDate: '2026-07-25T02:00:00Z',
        location: 'Hall A',
        area: 50,
        length: 10,
        width: 5,
        entrance: 'Cổng chính',
        siteConstraints: 'Không có thang máy',
        additionalRequests: 'Cần thêm bàn ghế',
        proposedItems: 'Loa JBL, Đèn Beam',
        notes: 'Ghi chú khảo sát',
        evidenceId: 'evi-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      reportCode: 'SUR-002',
      planId: 'plan-1',
      area: 50,
      length: 10,
      width: 5,
      entrance: 'Cổng chính',
      status: 'NEEDS_REVIEW',
    });
    expect(mockedRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'ord-1', planId: 'plan-1', reportedBy: 'user-1', reportCode: 'SUR-002' }),
    );
  });

  it('returns 404 when planId is provided but does not exist', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.planExists.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('LEADER'))
      .send({ orderId: 'ord-1', planId: 'missing-plan', surveyDate: '2026-07-25T02:00:00Z', location: 'Hall A' });

    expect(res.status).toBe(404);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects partial dimension data (area without length/width) with 400', async () => {
    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('LEADER'))
      .send({ orderId: 'ord-1', surveyDate: '2026-07-25T02:00:00Z', location: 'Hall A', area: 50 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('accepts a full dimension triplet (area + length + width together)', async () => {
    mockedRepo.orderExists.mockResolvedValue({ orderId: 'ord-1' });
    mockedRepo.generateNextReportCode.mockResolvedValue('SUR-001');
    mockedRepo.create.mockResolvedValue(fakeSurvey({ area: 50, length: 10, width: 5 }) as never);

    const res = await request(app)
      .post('/api/v1/survey-reports')
      .set('Authorization', authHeader('LEADER'))
      .send({ orderId: 'ord-1', surveyDate: '2026-07-25T02:00:00Z', location: 'Hall A', area: 50, length: 10, width: 5 });

    expect(res.status).toBe(201);
  });

  it('PUT /api/v1/survey-reports/:id/confirm is forbidden for LEADER (confirming is Manager-only)', async () => {
    const res = await request(app)
      .put('/api/v1/survey-reports/sur-1/confirm')
      .set('Authorization', authHeader('LEADER'))
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(403);
  });

  it('GET /api/v1/survey-reports is forbidden for TECHNICAL (mobile list is Leader/Manager/Admin only)', async () => {
    const res = await request(app).get('/api/v1/survey-reports').set('Authorization', authHeader('TECHNICAL'));
    expect(res.status).toBe(403);
  });

  it('GET /api/v1/survey-reports succeeds for LEADER (mobile reads back its own submitted reports)', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeSurvey()], totalItems: 1 } as never);
    mockedRepo.countByStatusGlobal.mockResolvedValue({ all: 1, draft: 0, needsReview: 1, submitted: 0, confirmed: 0 });

    const res = await request(app).get('/api/v1/survey-reports').set('Authorization', authHeader('LEADER'));

    expect(res.status).toBe(200);
  });

  it('GET /api/v1/survey-reports succeeds for ADMIN with tab counts in meta', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeSurvey()], totalItems: 1 } as never);
    mockedRepo.countByStatusGlobal.mockResolvedValue({ all: 1, draft: 0, needsReview: 1, submitted: 0, confirmed: 0 });

    const res = await request(app).get('/api/v1/survey-reports').set('Authorization', authHeader('ADMIN'));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ surveyId: 'sur-1', status: 'NEEDS_REVIEW', reportedByName: 'Le Van Leader' });
    expect(res.body.meta.counts).toEqual({ all: 1, draft: 0, needsReview: 1, submitted: 0, confirmed: 0 });
  });

  it('PUT /api/v1/survey-reports/:id/confirm succeeds for MANAGER', async () => {
    mockedRepo.findById.mockResolvedValue(fakeSurvey({ status: 'NEEDS_REVIEW' }) as never);
    mockedRepo.confirm.mockResolvedValue(fakeSurvey({ status: 'CONFIRMED' }) as never);

    const res = await request(app)
      .put('/api/v1/survey-reports/sur-1/confirm')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
  });
});
