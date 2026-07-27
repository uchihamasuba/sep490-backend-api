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
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updatePasswordHash: jest.fn(),
  },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

jest.mock('../../../utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockedRepo = userRepository as jest.Mocked<typeof userRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'leader-1',
    username: 'leader1',
    passwordHash: 'hash',
    fullName: 'Le Van Leader',
    role: 'STAFF',
    status: 'ACTIVE',
    email: 'leader1@example.com',
    phone: '0900000003',
    bio: null,
    avatarUrl: null,
    employeeCode: null,
    jobTitle: null,
    deviceToken: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/v1/users', () => {
  it('lists users filtered by role, without exposing email/phone', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeUser()], totalItems: 1 });

    const res = await request(app).get('/api/v1/users?role=STAFF').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ role: 'STAFF' }));
    expect(res.body.data[0]).toEqual({ userId: 'leader-1', username: 'leader1', fullName: 'Le Van Leader', role: 'STAFF', status: 'ACTIVE' });
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
    const res = await request(app).get('/api/v1/users').set('Authorization', authHeader('STAFF'));
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

  it('returns 404 with a Vietnamese message when the user does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/users/ghost').set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Không tìm thấy người dùng');
  });
});

describe('POST /api/v1/users', () => {
  beforeEach(() => {
    mockedRepo.findByUsername.mockResolvedValue(null);
    mockedRepo.findByEmail.mockResolvedValue(null);
    mockedRepo.findByPhone.mockResolvedValue(null);
  });

  it('creates the user and returns 200 with the mapped detail', async () => {
    mockedRepo.create.mockResolvedValue(fakeUser({ userId: 'u9', username: 'newuser' }));

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('ADMIN'))
      .send({ username: 'newuser', password: '123456', fullName: 'New User', email: 'test@example.com', role: 'STAFF' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ userId: 'u9', username: 'newuser' });
  });

  it('rejects a duplicate username with 400 and a Vietnamese message', async () => {
    mockedRepo.findByUsername.mockResolvedValue(fakeUser());

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('ADMIN'))
      .send({ username: 'leader1', password: '123456', fullName: 'New User', email: 'test@example.com', role: 'STAFF' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Tên đăng nhập đã tồn tại');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate email with 409 and a Vietnamese message', async () => {
    mockedRepo.findByEmail.mockResolvedValue(fakeUser());

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('ADMIN'))
      .send({ username: 'newuser', password: '123456', fullName: 'New User', role: 'STAFF', email: 'leader1@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Email đã được sử dụng');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate phone with 409 and a Vietnamese message', async () => {
    mockedRepo.findByPhone.mockResolvedValue(fakeUser());

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('ADMIN'))
      .send({ username: 'newuser', password: '123456', fullName: 'New User', email: 'test@example.com', role: 'STAFF', phone: '0900000003' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Số điện thoại đã được sử dụng');
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a payload missing required fields with 400', async () => {
    const res = await request(app).post('/api/v1/users').set('Authorization', authHeader('ADMIN')).send({});
    expect(res.status).toBe(400);
  });

  it('is forbidden for staff role', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('STAFF'))
      .send({ username: 'newuser', password: '123456', fullName: 'New User', email: 'test@example.com', role: 'STAFF' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/users/:userId', () => {
  it('updates the user and returns the mapped detail', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    mockedRepo.update.mockResolvedValue(fakeUser({ fullName: 'Updated Name' }));

    const res = await request(app)
      .put('/api/v1/users/leader-1')
      .set('Authorization', authHeader('ADMIN'))
      .send({ fullName: 'Updated Name', email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('Updated Name');
  });

  it('returns 404 with a Vietnamese message when the user does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/users/ghost')
      .set('Authorization', authHeader('ADMIN'))
      .send({ fullName: 'Updated Name', email: 'test@example.com' });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Không tìm thấy người dùng');
  });

  it('rejects a duplicate email (belonging to another account) with 409', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    mockedRepo.findByEmail.mockResolvedValue(fakeUser({ userId: 'someone-else' }));

    const res = await request(app)
      .put('/api/v1/users/leader-1')
      .set('Authorization', authHeader('ADMIN'))
      .send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Email đã được sử dụng');
    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  it('rejects a duplicate phone (belonging to another account) with 409', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    mockedRepo.findByEmail.mockResolvedValue(null);
    mockedRepo.findByPhone.mockResolvedValue(fakeUser({ userId: 'someone-else' }));

    const res = await request(app)
      .put('/api/v1/users/leader-1')
      .set('Authorization', authHeader('ADMIN'))
      .send({ phone: '0911111111', email: 'leader1@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Số điện thoại đã được sử dụng');
    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  it('allows keeping the caller own email/phone unchanged', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    mockedRepo.findByEmail.mockResolvedValue(fakeUser());
    mockedRepo.update.mockResolvedValue(fakeUser({ fullName: 'Updated Name' }));

    const res = await request(app)
      .put('/api/v1/users/leader-1')
      .set('Authorization', authHeader('ADMIN'))
      .send({ email: 'leader1@example.com', fullName: 'Updated Name' });

    expect(res.status).toBe(200);
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

  it('returns 404 with a Vietnamese message when the user does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/users/ghost/status')
      .set('Authorization', authHeader('ADMIN'))
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Không tìm thấy người dùng');
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

describe('POST /api/v1/users/:userId/reset-password', () => {
  it('resets the password and returns the mapped detail', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    mockedRepo.updatePasswordHash.mockResolvedValue(fakeUser());

    const res = await request(app)
      .post('/api/v1/users/leader-1/reset-password')
      .set('Authorization', authHeader('ADMIN'))
      .send({ newPassword: 'newpass1' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ userId: 'leader-1' });
    expect(mockedRepo.updatePasswordHash).toHaveBeenCalledWith('leader-1', 'hashed');
  });

  it('returns 404 with a Vietnamese message when the user does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/users/ghost/reset-password')
      .set('Authorization', authHeader('ADMIN'))
      .send({ newPassword: 'newpass1' });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Không tìm thấy người dùng');
  });

  it('rejects a password shorter than 6 characters with 400', async () => {
    const res = await request(app)
      .post('/api/v1/users/leader-1/reset-password')
      .set('Authorization', authHeader('ADMIN'))
      .send({ newPassword: '123' });

    expect(res.status).toBe(400);
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it('is forbidden for non-admin roles', async () => {
    const res = await request(app)
      .post('/api/v1/users/leader-1/reset-password')
      .set('Authorization', authHeader('MANAGER'))
      .send({ newPassword: 'newpass1' });

    expect(res.status).toBe(403);
  });
});
