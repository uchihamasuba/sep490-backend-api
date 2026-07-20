// Nạp .env TRƯỚC khi áp fallback bên dưới — env.ts cũng gọi 'dotenv/config' nhưng dotenv mặc định
// không ghi đè biến đã tồn tại trong process.env, nên nếu fallback chạy trước sẽ khiến giá trị .env
// thật (vd DATABASE_URL Aiven) bị bỏ qua vĩnh viễn cho toàn bộ test suite.
require('dotenv').config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-please-ignore';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://user:pass@localhost:3306/test_db';
process.env.LOG_LEVEL = 'silent';
