import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { employeeRepository } from '../employee.repository';

jest.mock('../employee.repository', () => ({
  employeeRepository: {
    findMany: jest.fn(),
    countByJobTitle: jest.fn(),
    countAll: jest.fn(),
    findById: jest.fn(),
    findByUsername: jest.fn(),
    generateNextEmployeeCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

const mockedRepo = employeeRepository as jest.Mocked<typeof employeeRepository>;

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'ADMIN') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function baseUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'u1',
    username: '0912345678',
    passwordHash: 'hashed',
    fullName: 'Nguyen Van A',
    role: 'TECHNICAL',
    status: 'ACTIVE',
    email: null,
    phone: '0912345678',
    bio: null,
    avatarUrl: null,
    employeeCode: 'NV001',
    jobTitle: 'Kỹ thuật',
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/v1/employees', () => {
  it('returns a paginated list with role counts in meta', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [baseUser()], totalItems: 1 });
    mockedRepo.countByJobTitle.mockResolvedValue([{ jobTitle: 'Kỹ thuật', count: 1 }]);
    mockedRepo.countAll.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/employees').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      id: 'u1',
      employeeCode: 'NV001',
      name: 'Nguyen Van A',
      role: { id: 'ky-thuat', name: 'Kỹ thuật' },
      status: 'ACTIVE',
      assignedBookings: 0,
    });
    expect(res.body.meta.counts).toMatchObject({ all: 1, 'ky-thuat': 1 });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/employees');
    expect(res.status).toBe(401);
  });

  it('allows LEADER/TECHNICAL to read (read-only roles)', async () => {
    mockedRepo.findMany.mockResolvedValue({ rows: [], totalItems: 0 });
    mockedRepo.countByJobTitle.mockResolvedValue([]);
    mockedRepo.countAll.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/employees').set('Authorization', authHeader('TECHNICAL'));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/employees', () => {
  it('creates an employee, generating username/employeeCode/tempPassword, and returns 201', async () => {
    mockedRepo.findByUsername.mockResolvedValue(null);
    mockedRepo.generateNextEmployeeCode.mockResolvedValue('NV002');
    mockedRepo.create.mockResolvedValue(baseUser({ userId: 'u2', employeeCode: 'NV002' }));

    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', authHeader())
      .send({ name: 'Nguyen Van B', phone: '0912345678', roleId: 'ky-thuat' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 'u2', employeeCode: 'NV002' });
    expect(res.body.data.tempPassword).toBeTruthy();
    expect(mockedRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Nguyen Van B', role: 'TECHNICAL', jobTitle: 'Kỹ thuật', employeeCode: 'NV002' }),
    );
  });

  it('rejects a payload with an unknown roleId with 400', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', authHeader())
      .send({ name: 'Nguyen Van B', phone: '0912345678', roleId: 'not-a-real-role' });

    expect(res.status).toBe(400);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a payload missing required fields with 400', async () => {
    const res = await request(app).post('/api/v1/employees').set('Authorization', authHeader()).send({ phone: '0912345678' });
    expect(res.status).toBe(400);
  });

  it('is forbidden for non-admin roles', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', authHeader('MANAGER'))
      .send({ name: 'Nguyen Van B', phone: '0912345678', roleId: 'ky-thuat' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/employees/:id', () => {
  it('returns 404 when the employee does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/employees/missing').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/employees/:id', () => {
  it('updates the employee and returns the mapped result', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());
    mockedRepo.update.mockResolvedValue(baseUser({ fullName: 'Updated Name', jobTitle: 'Bếp trưởng' }));

    const res = await request(app)
      .put('/api/v1/employees/u1')
      .set('Authorization', authHeader())
      .send({ name: 'Updated Name', phone: '0912345678', roleId: 'bep-truong' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Updated Name', role: { id: 'bep-truong', name: 'Bếp trưởng' } });
  });
});

describe('PATCH /api/v1/employees/:id/status', () => {
  it('updates status and returns the mapped result', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());
    mockedRepo.update.mockResolvedValue(baseUser({ status: 'INACTIVE' }));

    const res = await request(app)
      .patch('/api/v1/employees/u1/status')
      .set('Authorization', authHeader())
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('INACTIVE');
  });

  it('rejects an invalid status value with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/employees/u1/status')
      .set('Authorization', authHeader())
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(400);
  });
});
