import { z } from 'zod';

// PUT /settings/bank-account (Admin) — cấu hình tài khoản ngân hàng công ty để sinh QR SePay/VietQR.
export const updateBankAccountBodySchema = z.object({
  // Mã ngân hàng truyền cho SePay (param `bank`): chấp nhận BIN (vd 970436) hoặc short_name (vd Vietcombank).
  bankBin: z.string().trim().min(1, 'Vui lòng nhập mã ngân hàng (BIN hoặc short name)'),
  bankName: z.string().trim().min(1, 'Vui lòng nhập tên ngân hàng'),
  accountNumber: z.string().trim().min(1, 'Vui lòng nhập số tài khoản'),
  accountName: z.string().trim().min(1, 'Vui lòng nhập tên chủ tài khoản'),
});

export type UpdateBankAccountBody = z.infer<typeof updateBankAccountBodySchema>;

// GET /settings/transactions — proxy SePay list transactions (userapi.sepay.vn/v2/transactions).
export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  transferType: z.enum(['in', 'out']).optional(),
  dateFrom: z.string().trim().min(1).optional(), // yyyy-mm-dd (bao gồm)
  dateTo: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(), // tìm theo reference_number / transaction_content / code
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
