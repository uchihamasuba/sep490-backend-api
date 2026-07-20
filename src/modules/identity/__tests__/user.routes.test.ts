import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { userRepository } from '../user.repository';

jest.mock('../user.repository', () => ({
  userRepository: {
    findByUsername: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updatePasswordHash: jest.fn(),
  },
}));

const mockedRepo = userRepository as jest.Mocked<typeof userRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'leader-1',
    username: 'leader1',
    passwordHash: 'hash',
    fullName: 'Le Van Leader',
    role: 'LEADER',
    status: 'ACTIVE',
    email: 'leader1@example.com',
    phone: '0900000003',
    bio: null,
    avatarUrl: null,
    employeeCode: null,
    jobTitle: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/v1/users', () => {
  it('lists users filtered by role, without exposing email/phone', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeUser()], totalItems: 1 });

    const res = await request(app).get('/api/v1/users?role=LEADER').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ role: 'LEADER' }));
    expect(res.body.data[0]).toEqual({ userId: 'leader-1', username: 'leader1', fullName: 'Le Van Leader', role: 'LEADER', status: 'ACTIVE' });
    expect(res.body.data[0].email).toBeUndefined();
    expect(res.body.data[0].phone).toBeUndefined();
  });

  it('rejects an invalid role filter with 400', async () => {
    const res = await request(app).get('/api/v1/users?role=OWNER').set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.findMany).not.toHaveBeenCalled();
  });

  it('rejects roles outside manager/admin with 403', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', authHeader('TECHNICAL'));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/users/:userId', () => {
  it('returns the full profile including email/phone', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());

    const res = await request(app).get('/api/v1/users/leader-1').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ userId: 'leader-1', email: 'leader1@example.com', phone: '0900000003' });
  });

  it('returns 404 when the user does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/users/ghost').set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/users/:userId/status', () => {
  it('updates the status and returns the mapped profile', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    mockedRepo.update.mockResolvedValue(fakeUser({ status: 'SUSPENDED' }));

    const res = await request(app)
      .patch('/api/v1/users/leader-1/status')
      .set('Authorization', authHeader('ADMIN'))
      .send({ status: 'SUSPENDED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUSPENDED');
    expect(mockedRepo.update).toHaveBeenCalledWith('leader-1', { status: 'SUSPENDED' });
  });

  it('returns 404 when the user does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/users/ghost/status')
      .set('Authorization', authHeader('ADMIN'))
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(404);
  });

  it('rejects an invalid status value with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/users/leader-1/status')
      .set('Authorization', authHeader('ADMIN'))
      .send({ status: 'BANNED' });
    expect(res.status).toBe(400);
  });

  it('is forbidden for non-admin roles', async () => {
    const res = await request(app)
      .patch('/api/v1/users/leader-1/status')
      .set('Authorization', authHeader('MANAGER'))
      .send({ status: 'INACTIVE' });
    expect(res.status).toBe(403);
  });
});
