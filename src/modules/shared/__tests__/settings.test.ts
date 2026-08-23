import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { prisma } from '../../../db/prisma';

function authHeader(role: 'MANAGER' | 'ADMIN' | 'STAFF' = 'MANAGER') {
  const token = jwt.sign({ id: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

describe('GET /api/v1/settings/bank-account', () => {
  beforeEach(async () => {
    await prisma.companyBankAccount.deleteMany();
  });

  afterAll(async () => {
    await prisma.companyBankAccount.deleteMany();
  });

  it('returns the configured bank account', async () => {
    await prisma.companyBankAccount.create({
      data: {
        bankBin: '970436',
        bankName: 'MB Bank',
        accountNumber: '0000000000',
        accountName: 'CONG TY SEP490',
      },
    });

    const res = await request(app).get('/api/v1/settings/bank-account').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({
      bankBin: '970436',
      bankName: 'MB Bank',
      accountNumber: '0000000000',
      accountName: 'CONG TY SEP490',
      configured: true,
    }));
  });

  it('returns null fields when not configured', async () => {
    const res = await request(app).get('/api/v1/settings/bank-account').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      bankBin: null,
      bankName: null,
      accountNumber: null,
      accountName: null,
      configured: false,
      updatedAt: null,
    });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/settings/bank-account');
    expect(res.status).toBe(401);
  });

  it('allows STAFF to read bank account with 200', async () => {
    const res = await request(app).get('/api/v1/settings/bank-account').set('Authorization', authHeader('STAFF'));
    expect(res.status).toBe(200);
  });
});
