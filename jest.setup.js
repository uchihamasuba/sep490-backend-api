process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-please-ignore';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://user:pass@localhost:3306/test_db';
process.env.LOG_LEVEL = 'silent';
