import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';

function authHeader(role: 'MANAGER' | 'ADMIN' | 'LEADER' | 'TECHNICAL' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

describe('GET /api/v1/settings/bank-account', () => {
  const originalEnv = { ...env };

  afterEach(() => {
    Object.assign(env, originalEnv);
  });

  it('returns the configured bank account', async () => {
    Object.assign(env, {
      COMPANY_BANK_BIN: '970436',
      COMPANY_BANK_NAME: 'MB Bank',
      COMPANY_BANK_ACCOUNT_NUMBER: '0000000000',
      COMPANY_BANK_ACCOUNT_NAME: 'CONG TY SEP490',
    });

    const res = await request(app).get('/api/v1/settings/bank-account').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      bankBin: '970436',
      bankName: 'MB Bank',
      accountNumber: '0000000000',
      accountName: 'CONG TY SEP490',
    });
  });

  it('returns null fields when not configured', async () => {
    Object.assign(env, {
      COMPANY_BANK_BIN: undefined,
      COMPANY_BANK_NAME: undefined,
      COMPANY_BANK_ACCOUNT_NUMBER: undefined,
      COMPANY_BANK_ACCOUNT_NAME: undefined,
    });

    const res = await request(app).get('/api/v1/settings/bank-account').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      bankBin: null,
      bankName: null,
      accountNumber: null,
      accountName: null,
    });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/settings/bank-account');
    expect(res.status).toBe(401);
  });

  it('rejects roles outside manager/admin with 403', async () => {
    const res = await request(app).get('/api/v1/settings/bank-account').set('Authorization', authHeader('TECHNICAL'));
    expect(res.status).toBe(403);
  });
});
