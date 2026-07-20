import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { User, UserRole, UserStatus } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { userRepository } from '../user.repository';

jest.mock('../user.repository', () => ({
  userRepository: {
    findByUsername: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    updatePasswordHash: jest.fn(),
  },
}));

const mockedRepo = userRepository as jest.Mocked<typeof userRepository>;

const PLAIN_PASSWORD = '123456';
let PASSWORD_HASH: string;

beforeAll(async () => {
  PASSWORD_HASH = await bcrypt.hash(PLAIN_PASSWORD, 10);
});

function baseUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'u1',
    username: 'manager',
    passwordHash: PASSWORD_HASH,
    fullName: 'Project Manager',
    role: 'MANAGER' as UserRole,
    status: 'ACTIVE' as UserStatus,
    email: 'manager@bnw.com',
    phone: '0900000002',
    bio: null,
    avatarUrl: null,
    createdAt: new Date('2026-07-19T16:47:34.000Z'),
    updatedAt: new Date('2026-07-19T16:47:34.000Z'),
    ...overrides,
  };
}

function authHeaderFor(userId = 'u1', role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with a token and the correctly-shaped user object on success', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser());

    const res = await request(app).post('/api/v1/auth/login').send({ username: 'manager', password: PLAIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user).toEqual({
      userId: 'u1',
      username: 'manager',
      fullName: 'Project Manager',
      role: { roleId: 'role-manager', roleName: 'Manager' },
      status: 'active',
    });
  });

  it('returns 401 for a wrong username/password', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser());

    const res = await request(app).post('/api/v1/auth/login').send({ username: 'manager', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when the account is locked (SUSPENDED)', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser({ status: 'SUSPENDED' }));

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'manager', password: PLAIN_PASSWORD });

    expect(res.status).toBe(403);
  });

  it('returns 400 when the request body fails validation', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('always returns 200 with null data, whether or not the account exists', async () => {
    mockedRepo.findByUsername.mockResolvedValueOnce(baseUser());
    const found = await request(app).post('/api/v1/auth/forgot-password').send({ username: 'manager' });
    expect(found.status).toBe(200);
    expect(found.body.data).toBeNull();

    mockedRepo.findByUsername.mockResolvedValueOnce(null);
    const notFound = await request(app).post('/api/v1/auth/forgot-password').send({ username: 'ghost' });
    expect(notFound.status).toBe(200);
    expect(notFound.body.data).toBeNull();
  });
});

describe('GET /api/v1/auth/profile', () => {
  it('requires authentication (401 without a token)', async () => {
    const res = await request(app).get('/api/v1/auth/profile');
    expect(res.status).toBe(401);
  });

  it('returns the current user profile for a valid token', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());

    const res = await request(app).get('/api/v1/auth/profile').set('Authorization', authHeaderFor());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      userId: 'u1',
      username: 'manager',
      email: 'manager@bnw.com',
      phone: '0900000002',
      status: 'active',
    });
  });
});

describe('PUT /api/v1/auth/profile', () => {
  it('updates the caller own profile', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());
    mockedRepo.update.mockResolvedValue(baseUser({ fullName: 'Updated Name' }));

    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', authHeaderFor())
      .send({ fullName: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('Updated Name');
    expect(mockedRepo.update).toHaveBeenCalledWith('u1', { fullName: 'Updated Name' });
  });
});

describe('PUT /api/v1/auth/change-password', () => {
  it('returns 400 when confirmNewPassword does not match newPassword (validated before touching the DB)', async () => {
    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', authHeaderFor())
      .send({ oldPassword: PLAIN_PASSWORD, newPassword: 'newpass1', confirmNewPassword: 'different' });

    expect(res.status).toBe(400);
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it('returns 400 when oldPassword is wrong', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', authHeaderFor())
      .send({ oldPassword: 'wrong-old-password', newPassword: 'newpass1', confirmNewPassword: 'newpass1' });

    expect(res.status).toBe(400);
    expect(mockedRepo.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('returns 200 and stores the new hash when oldPassword is correct', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());
    mockedRepo.updatePasswordHash.mockResolvedValue(baseUser());

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', authHeaderFor())
      .send({ oldPassword: PLAIN_PASSWORD, newPassword: 'newpass1', confirmNewPassword: 'newpass1' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(mockedRepo.updatePasswordHash).toHaveBeenCalledTimes(1);
  });
});
