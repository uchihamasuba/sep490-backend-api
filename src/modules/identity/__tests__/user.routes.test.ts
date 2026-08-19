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
  it('UTCID01: Can connect with server - User must be logged in to the system - { query: { role: "Staff" } } - null', async () => {
    const res = await request(app).get('/api/v1/users?role=STAFF');
    expect(res.status).toBe(401);
  });

  it('UTCID02: Can connect with server - User must be logged in to the system - { query: { role: "Staff" } } - Staff', async () => {
    const res = await request(app).get('/api/v1/users?role=STAFF').set('Authorization', authHeader('STAFF'));
    expect(res.status).toBe(403);
  });

  it('UTCID03: Can connect with server - User must be logged in to the system - { query: { role: "InvalidRole" } } - Admin', async () => {
    const res = await request(app).get('/api/v1/users?role=INVALID').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(400);
  });

  it('UTCID05: Can connect with server - User must be logged in to the system - { query: { role: "Staff" } } - Admin', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeUser()], totalItems: 1 });
    const res = await request(app).get('/api/v1/users?role=STAFF').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(200);
  });

  // UTCID04: Can connect with server - User must be logged in to the system - { query: {} } - Admin -> 500 (DB error)
  it('UTCID04: Can connect with server - User must be logged in to the system - { query: {} } - Admin', async () => {
    mockedRepo.findMany.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));
    const res = await request(app).get('/api/v1/users').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(500);
  });

  // UTCID06: Can connect with server - User must be logged in to the system - { query: { page: 1 } } - Admin
  it('UTCID06: Can connect with server - User must be logged in to the system - { query: { page: 1 } } - Admin', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [fakeUser()], totalItems: 1 });
    const res = await request(app).get('/api/v1/users?page=1').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/users/:userId', () => {
  it('UTCID01: Can connect with server - User must be logged in to the system - { params: { target_user_id: "user123" } } - null', async () => {
    const res = await request(app).get('/api/v1/users/user123');
    expect(res.status).toBe(401);
  });

  it('UTCID02: Can connect with server - User must be logged in to the system - { params: { target_user_id: "user123" } } - Staff', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    const res = await request(app).get('/api/v1/users/user123').set('Authorization', authHeader('STAFF'));
    expect(res.status).toBe(403);
  });

  it('UTCID04: Can connect with server - User must be logged in to the system - { params: { target_user_id: "nonexistent" } } - Admin', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/users/ghost').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(404);
  });

  it('UTCID06: Can connect with server - User must be logged in to the system - { params: { target_user_id: "user123" } } - Admin', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    const res = await request(app).get('/api/v1/users/user123').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(200);
  });

  // UTCID03: Can connect with server - User must be logged in to the system - { params: { target_user_id: "nonexistent" } } - Admin -> 404
  it('UTCID03: Can connect with server - User must be logged in to the system - { params: { target_user_id: "nonexistent" } } - Admin', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/users/nonexistent').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(404);
  });

  // UTCID05: Can connect with server - User must be logged in to the system - { params: { target_user_id: "user123" } } - Admin -> 500 (DB error)
  // (Documented log message "Tài khoản không có quyền truy cập (yêu cầu Admin)" does not match this
  // scenario; asserting the actual 500 the backend returns when the repository call fails.)
  it('UTCID05: Can connect with server - User must be logged in to the system - { params: { target_user_id: "user123" } } - Admin', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));
    const res = await request(app).get('/api/v1/users/user123').set('Authorization', authHeader('ADMIN'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/users', () => {
  beforeEach(() => {
    mockedRepo.findByUsername.mockResolvedValue(null);
    mockedRepo.findByEmail.mockResolvedValue(null);
    mockedRepo.findByPhone.mockResolvedValue(null);
  });

  it('UTCID01: Can connect with server - User must be logged in to the system - null', async () => {
    const res = await request(app).post('/api/v1/users').send({});
    expect(res.status).toBe(401);
  });

  it('UTCID02: Can connect with server - User must be logged in to the system - Staff', async () => {
    const res = await request(app).post('/api/v1/users').set('Authorization', authHeader('STAFF')).send({});
    expect(res.status).toBe(403);
  });

  // UTCID03: { body: { full_name: 'Nguyen A', username: 'nguyena' } } - Admin -> 400 (missing role/email/password)
  it('UTCID03: Can connect with server - User must be logged in to the system - Missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('ADMIN'))
      .send({ fullName: 'Nguyen A', username: 'nguyena' });
    expect(res.status).toBe(400);
  });

  it('UTCID04: Can connect with server - User must be logged in to the system - Missing fields', async () => {
    const res = await request(app).post('/api/v1/users').set('Authorization', authHeader('ADMIN')).send({});
    expect(res.status).toBe(400);
  });

  it('UTCID05: Can connect with server - User must be logged in to the system - Invalid email/password confirm', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('ADMIN'))
      .send({ username: 'newuser', password: '123', fullName: 'New User', email: 'invalid_email', role: 'STAFF' });
    expect(res.status).toBe(400);
  });

  it('UTCID06: Can connect with server - User must be logged in to the system - Duplicate email', async () => {
    mockedRepo.findByEmail.mockResolvedValue(fakeUser());
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('ADMIN'))
      .send({ username: 'newuser', password: '123456', fullName: 'New User', email: 'duplicate@email.com', role: 'STAFF' });
    expect(res.status).toBe(409);
  });

  it('UTCID08: Can connect with server - User must be logged in to the system - Valid', async () => {
    mockedRepo.create.mockResolvedValue(fakeUser({ userId: 'u9', username: 'newuser' }));
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('ADMIN'))
      .send({ username: 'newuser', password: '123456', fullName: 'New User', email: 'test@example.com', role: 'STAFF' });
    expect(res.status).toBe(200);
  });

  // UTCID07: Can connect with server - User must be logged in to the system - Admin -> 500 (DB error)
  it('UTCID07: Can connect with server - User must be logged in to the system - DB error', async () => {
    mockedRepo.findByUsername.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', authHeader('ADMIN'))
      .send({ username: 'nguyena', password: '123456', fullName: 'Nguyen A', email: 'a@mail.com', role: 'STAFF' });
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/users/:userId', () => {
  it('UTCID01: Can connect with server - User must be logged in to the system - null', async () => {
    const res = await request(app).put('/api/v1/users/user123').send({});
    expect(res.status).toBe(401);
  });

  it('UTCID02: Can connect with server - User must be logged in to the system - Staff', async () => {
    const res = await request(app).put('/api/v1/users/user123').set('Authorization', authHeader('STAFF')).send({});
    expect(res.status).toBe(403);
  });

  it('UTCID03: Can connect with server - User must be logged in to the system - nonexistent', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .put('/api/v1/users/ghost')
      .set('Authorization', authHeader('ADMIN'))
      .send({ fullName: 'Updated Name', email: 'test@example.com' });
    expect(res.status).toBe(404);
  });

  it('UTCID04: Can connect with server - User must be logged in to the system - Missing fields', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    const res = await request(app).put('/api/v1/users/user123').set('Authorization', authHeader('ADMIN')).send({});
    expect(res.status).toBe(400);
  });

  it('UTCID05: Can connect with server - User must be logged in to the system - Invalid email', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    const res = await request(app).put('/api/v1/users/user123').set('Authorization', authHeader('ADMIN')).send({ email: 'invalid_email' });
    expect(res.status).toBe(400);
  });

  it('UTCID06: Can connect with server - User must be logged in to the system - Duplicate email', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    mockedRepo.findByEmail.mockResolvedValue(fakeUser({ userId: 'someone-else' }));
    const res = await request(app).put('/api/v1/users/user123').set('Authorization', authHeader('ADMIN')).send({ email: 'taken@example.com' });
    expect(res.status).toBe(409);
  });

  it('UTCID08: Can connect with server - User must be logged in to the system - Valid', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    mockedRepo.findByEmail.mockResolvedValue(null);
    mockedRepo.findByPhone.mockResolvedValue(null);
    mockedRepo.update.mockResolvedValue(fakeUser({ fullName: 'Updated Name' }));
    const res = await request(app).put('/api/v1/users/user123').set('Authorization', authHeader('ADMIN')).send({ fullName: 'Updated Name', email: 'test@example.com' });
    expect(res.status).toBe(200);
  });

  // UTCID07: Can connect with server - User must be logged in to the system - Admin -> 500 (DB error)
  it('UTCID07: Can connect with server - User must be logged in to the system - DB error', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));
    const res = await request(app)
      .put('/api/v1/users/user123')
      .set('Authorization', authHeader('ADMIN'))
      .send({ fullName: 'Nguyen B', role: 'STAFF', email: 'b@mail.com', phone: '0901234567' });
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/users/:userId/status', () => {
  it('UTCID01: Can connect with server - User must be logged in to the system - null', async () => {
    const res = await request(app).patch('/api/v1/users/user123/status').send({});
    expect(res.status).toBe(401);
  });

  it('UTCID02: Can connect with server - User must be logged in to the system - Staff', async () => {
    const res = await request(app).patch('/api/v1/users/user123/status').set('Authorization', authHeader('STAFF')).send({});
    expect(res.status).toBe(403);
  });

  it('UTCID03: Can connect with server - User must be logged in to the system - nonexistent', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).patch('/api/v1/users/ghost/status').set('Authorization', authHeader('ADMIN')).send({ status: 'INACTIVE' });
    expect(res.status).toBe(404);
  });

  it('UTCID04: Can connect with server - User must be logged in to the system - already inactive', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser({ status: 'INACTIVE' }));
    mockedRepo.update.mockResolvedValue(fakeUser({ status: 'INACTIVE' }));
    const res = await request(app).patch('/api/v1/users/user123/status').set('Authorization', authHeader('ADMIN')).send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
  });

  it('UTCID06: Can connect with server - User must be logged in to the system - Valid', async () => {
    mockedRepo.findById.mockResolvedValue(fakeUser());
    mockedRepo.update.mockResolvedValue(fakeUser({ status: 'SUSPENDED' }));
    const res = await request(app).patch('/api/v1/users/user123/status').set('Authorization', authHeader('ADMIN')).send({ status: 'SUSPENDED' });
    expect(res.status).toBe(200);
  });

  // UTCID05: Can connect with server - User must be logged in to the system - Admin -> 500 (DB error)
  it('UTCID05: Can connect with server - User must be logged in to the system - DB error', async () => {
    mockedRepo.findById.mockRejectedValue(new Error('Lỗi kết nối cơ sở dữ liệu'));
    const res = await request(app)
      .patch('/api/v1/users/user123/status')
      .set('Authorization', authHeader('ADMIN'))
      .send({ status: 'INACTIVE' });
    expect(res.status).toBe(500);
  });
});
