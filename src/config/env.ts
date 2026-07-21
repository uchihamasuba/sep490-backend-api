import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Firebase Storage (upload evidences) — configured manually in Task 1.4.
  // Optional at boot: only the evidences upload feature depends on these.
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  // Tài khoản ngân hàng nhận cọc/quyết toán của công ty (docs/api/more-require.md mục 1) — trước đây
  // hardcode ở FE (src/constants/company-bank.ts), chưa có bảng cấu hình nào ở DB. Optional: GET
  // /settings/bank-account trả null cho field nào chưa cấu hình thay vì bịa giá trị giả.
  COMPANY_BANK_BIN: z.string().optional(),
  COMPANY_BANK_NAME: z.string().optional(),
  COMPANY_BANK_ACCOUNT_NUMBER: z.string().optional(),
  COMPANY_BANK_ACCOUNT_NAME: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', z.treeifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
