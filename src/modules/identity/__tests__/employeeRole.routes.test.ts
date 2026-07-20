import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { EMPLOYEE_ROLES } from '../employeeRole.constants';

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'ADMIN') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

describe('GET /api/v1/employee-roles', () => {
  it('returns the fixed 6-value static list', async () => {
    const res = await request(app).get('/api/v1/employee-roles').set('Authorization', authHeader('TECHNICAL'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(EMPLOYEE_ROLES);
    expect(res.body.data).toHaveLength(6);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/employee-roles');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/employee-roles', () => {
  it('is rejected with 400 — static list, not an editable catalog', async () => {
    const res = await request(app)
      .post('/api/v1/employee-roles')
      .set('Authorization', authHeader())
      .send({ name: 'New role' });
    expect(res.status).toBe(400);
  });

  it('is forbidden for non-admin roles', async () => {
    const res = await request(app).post('/api/v1/employee-roles').set('Authorization', authHeader('MANAGER')).send({});
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/employee-roles/:id', () => {
  it('is rejected with 400 — static list, not an editable catalog', async () => {
    const res = await request(app)
      .put('/api/v1/employee-roles/quan-ly')
      .set('Authorization', authHeader())
      .send({ name: 'Renamed' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/employee-roles/:id', () => {
  it('is rejected with 400 — static list, not an editable catalog', async () => {
    const res = await request(app).delete('/api/v1/employee-roles/quan-ly').set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });
});
