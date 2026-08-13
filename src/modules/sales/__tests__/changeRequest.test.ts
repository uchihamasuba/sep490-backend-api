import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { changeRequestRouter } from '../changeRequest.routes';
import { changeRequestService } from '../changeRequest.service';
import { errorHandler } from '../../../middleware/error';
import { env } from '../../../config/env';

jest.mock('../changeRequest.service', () => ({
  changeRequestService: {
    listChangeRequests: jest.fn(),
    approveChangeRequest: jest.fn(),
  },
}));

const mockedService = changeRequestService as jest.Mocked<typeof changeRequestService>;

function authHeader(role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'LEADER', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

const app = express();
app.use(express.json());
app.use('/api/v1/change-requests', changeRequestRouter);
app.use(errorHandler);

describe('Change Request Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/change-requests', () => {
    describe('Permissions & Authentication', () => {
      it('returns 401 when no token is provided', async () => {
        const res = await request(app).get('/api/v1/change-requests');
        expect(res.status).toBe(401);
      });

      it.each(['STAFF', 'LEADER'] as const)(
        'returns 403 when user is %s',
        async (role) => {
          const res = await request(app)
            .get('/api/v1/change-requests')
            .set('Authorization', authHeader(role));
          expect(res.status).toBe(403);
        }
      );

      it.each(['ADMIN', 'MANAGER'] as const)(
        'allows %s to list change requests',
        async (role) => {
          mockedService.listChangeRequests.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
          const res = await request(app)
            .get('/api/v1/change-requests')
            .set('Authorization', authHeader(role));
          expect(res.status).toBe(200);
        }
      );
    });

    describe('Validation', () => {
      it.each([
        { query: 'status=INVALID_STATUS', expected: 400 },
        { query: 'page=0', expected: 400 },
        { query: 'limit=101', expected: 400 },
      ])('returns $expected when query is $query', async ({ query, expected }) => {
        const res = await request(app)
          .get(`/api/v1/change-requests?${query}`)
          .set('Authorization', authHeader('ADMIN'));
        expect(res.status).toBe(expected);
      });

      it('calls service with default pagination when no query provided', async () => {
        mockedService.listChangeRequests.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
        await request(app)
          .get('/api/v1/change-requests')
          .set('Authorization', authHeader('ADMIN'));
        
        expect(mockedService.listChangeRequests).toHaveBeenCalledWith({
          page: 1,
          limit: 10,
        });
      });
    });
  });

  describe('PUT /api/v1/change-requests/:changeRequestId/approve', () => {
    describe('Permissions & Authentication', () => {
      it('returns 401 when no token is provided', async () => {
        const res = await request(app)
          .put('/api/v1/change-requests/cr1/approve')
          .send({ status: 'APPROVED' });
        expect(res.status).toBe(401);
      });

      it.each(['STAFF', 'LEADER'] as const)(
        'returns 403 when user is %s',
        async (role) => {
          const res = await request(app)
            .put('/api/v1/change-requests/cr1/approve')
            .send({ status: 'APPROVED' })
            .set('Authorization', authHeader(role));
          expect(res.status).toBe(403);
        }
      );

      it('allows MANAGER to approve change requests', async () => {
        mockedService.approveChangeRequest.mockResolvedValue({ changeRequestId: 'cr1' } as any);
        const res = await request(app)
          .put('/api/v1/change-requests/cr1/approve')
          .send({ status: 'approved' })
          .set('Authorization', authHeader('MANAGER'));
        expect(res.status).toBe(200);
      });
    });

    describe('Validation', () => {
      it.each([
        { body: {}, expected: 400 },
        { body: { status: 'INVALID' }, expected: 400 },
        { body: { status: 'pending' }, expected: 400 },
        { body: { status: 'approved' }, expected: 200 },
        { body: { status: 'rejected' }, expected: 200 },
      ])('returns $expected when body is $body', async ({ body, expected }) => {
        mockedService.approveChangeRequest.mockResolvedValue({ changeRequestId: 'cr1' } as any);
        const res = await request(app)
          .put('/api/v1/change-requests/cr1/approve')
          .send(body)
          .set('Authorization', authHeader('MANAGER'));
        expect(res.status).toBe(expected);
      });
    });

    describe('Service Integration', () => {
      it('calls approveChangeRequest with correct arguments', async () => {
        mockedService.approveChangeRequest.mockResolvedValue({ changeRequestId: 'cr1' } as any);
        
        await request(app)
          .put('/api/v1/change-requests/cr1/approve')
          .send({ status: 'rejected' })
          .set('Authorization', authHeader('MANAGER'));

        expect(mockedService.approveChangeRequest).toHaveBeenCalledWith('cr1', {
          status: 'rejected',
        });
      });
    });
  });
});
