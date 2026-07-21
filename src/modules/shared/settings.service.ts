import { env } from '../../config/env';

export interface BankAccountDTO {
  bankBin: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

// Không có bảng cấu hình nào ở DB cho tài khoản ngân hàng công ty (docs/api/more-require.md mục 1) —
// đọc từ env thay vì hardcode ở FE. Trả null cho field chưa cấu hình thay vì bịa giá trị giả.
function getBankAccount(): BankAccountDTO {
  return {
    bankBin: env.COMPANY_BANK_BIN ?? null,
    bankName: env.COMPANY_BANK_NAME ?? null,
    accountNumber: env.COMPANY_BANK_ACCOUNT_NUMBER ?? null,
    accountName: env.COMPANY_BANK_ACCOUNT_NAME ?? null,
  };
}

export const settingsService = {
  getBankAccount,
};
