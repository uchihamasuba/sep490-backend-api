import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { settingsRepository } from './settings.repository';
import type { ListTransactionsQuery, UpdateBankAccountBody } from './settings.validators';

export interface BankAccountDTO {
  bankBin: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  // configured = đã cấu hình đủ (có mã NH + số TK) → FE/mobile mới dựng được QR.
  configured: boolean;
  updatedAt: string | null;
}

// Nguồn ưu tiên: bảng company_bank_accounts (Admin cấu hình trong app). Nếu DB chưa có → fallback env
// (COMPANY_BANK_*), thường null. Trả null cho field chưa cấu hình thay vì bịa giá trị giả.
async function getBankAccount(): Promise<BankAccountDTO> {
  const row = await settingsRepository.getBankAccount();
  if (row) {
    return {
      bankBin: row.bankBin,
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      accountName: row.accountName,
      configured: true,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  const bankBin = env.COMPANY_BANK_BIN ?? null;
  const bankName = env.COMPANY_BANK_NAME ?? null;
  const accountNumber = env.COMPANY_BANK_ACCOUNT_NUMBER ?? null;
  const accountName = env.COMPANY_BANK_ACCOUNT_NAME ?? null;
  return {
    bankBin,
    bankName,
    accountNumber,
    accountName,
    configured: Boolean(bankBin && accountNumber),
    updatedAt: null,
  };
}

async function updateBankAccount(body: UpdateBankAccountBody, actorId: string): Promise<BankAccountDTO> {
  const row = await settingsRepository.upsertBankAccount({
    bankBin: body.bankBin,
    bankName: body.bankName,
    accountNumber: body.accountNumber,
    accountName: body.accountName,
    updatedBy: actorId,
  });
  return {
    bankBin: row.bankBin,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    configured: true,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================================
// Lịch sử giao dịch — proxy SePay v2 (GET userapi.sepay.vn/v2/transactions). Token BÍ MẬT ở env, KHÔNG
// lộ ra FE. Lọc theo account_number của tài khoản Admin đã cấu hình (giả định 1 tài khoản/merchant —
// nếu merchant nhiều TK, chỉ hiện đúng TK đã cấu hình). `configured` = đã có token + tài khoản.
// ============================================================================
export interface SepayTransactionDTO {
  id: string;
  transactionDate: string | null;
  accountNumber: string | null;
  bankBrandName: string | null;
  transferType: string | null; // 'in' | 'out'
  amountIn: number;
  amountOut: number;
  accumulated: number;
  content: string | null;
  referenceNumber: string | null;
  code: string | null;
}

export interface TransactionListResult {
  configured: boolean;
  data: SepayTransactionDTO[];
  meta: { page: number; perPage: number; total: number; totalPages: number; hasMore: boolean };
}

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

function mapTxn(row: Record<string, unknown>): SepayTransactionDTO {
  return {
    id: String(row.id ?? ''),
    transactionDate: row.transaction_date ? String(row.transaction_date) : null,
    accountNumber: row.account_number ? String(row.account_number) : null,
    bankBrandName: row.bank_brand_name ? String(row.bank_brand_name) : null,
    transferType: row.transfer_type ? String(row.transfer_type) : null,
    amountIn: toNum(row.amount_in),
    amountOut: toNum(row.amount_out),
    accumulated: toNum(row.accumulated),
    content: row.transaction_content ? String(row.transaction_content) : null,
    referenceNumber: row.reference_number ? String(row.reference_number) : null,
    code: row.code ? String(row.code) : null,
  };
}

async function listTransactions(query: ListTransactionsQuery): Promise<TransactionListResult> {
  const token = env.SEPAY_API_TOKEN;
  const account = await getBankAccount();
  const emptyMeta = { page: query.page, perPage: query.perPage, total: 0, totalPages: 0, hasMore: false };

  // Chưa cấu hình token SePay hoặc chưa cấu hình tài khoản → trả trạng thái "chưa cấu hình" (không lỗi).
  if (!token || !account.accountNumber) {
    return { configured: false, data: [], meta: emptyMeta };
  }

  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('per_page', String(query.perPage));
  params.set('transaction_date_sort', 'desc');
  if (query.transferType) params.set('transfer_type', query.transferType);
  if (query.dateFrom) params.set('transaction_date_from', query.dateFrom);
  if (query.dateTo) params.set('transaction_date_to', query.dateTo);
  if (query.q) params.set('q', query.q);

  let body: Record<string, unknown>;
  try {
    const res = await fetch(`${env.SEPAY_API_BASE}/transactions?${params.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw AppError.internal(`SePay trả lỗi ${res.status} khi lấy lịch sử giao dịch`);
    }
    body = (await res.json()) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.internal('Không kết nối được SePay để lấy lịch sử giao dịch');
  }

  const rows = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
  // Chỉ giữ giao dịch của đúng tài khoản Admin đã cấu hình.
  const filtered = rows.filter((r) => String(r.account_number ?? '') === account.accountNumber);
  const pagination = ((body.meta as Record<string, unknown> | undefined)?.pagination ?? {}) as Record<string, unknown>;

  return {
    configured: true,
    data: filtered.map(mapTxn),
    meta: {
      page: Number(pagination.current_page ?? query.page),
      perPage: Number(pagination.per_page ?? query.perPage),
      total: Number(pagination.total ?? filtered.length),
      totalPages: Number(pagination.last_page ?? 1),
      hasMore: Boolean(pagination.has_more ?? false),
    },
  };
}

// ============================================================================
// Danh sách ngân hàng (proxy banks.json của VietQR/SePay) — để Admin CHỌN ngân hàng khi cấu hình tài
// khoản thay vì gõ tay mã BIN. Cache in-memory 24h (danh sách ít đổi); fetch fail mà còn cache cũ thì
// trả cache. `bin` dùng làm mã ngân hàng cho SePay, `shortName` là tên hiển thị.
// ============================================================================
export interface BankDTO {
  bin: string;
  code: string;
  shortName: string;
  name: string;
}

let banksCache: { at: number; data: BankDTO[] } | null = null;
const BANKS_TTL_MS = 24 * 60 * 60 * 1000;

async function listBanks(): Promise<BankDTO[]> {
  const now = Date.now();
  if (banksCache && now - banksCache.at < BANKS_TTL_MS) return banksCache.data;

  try {
    const res = await fetch(env.BANKS_JSON_URL, { method: 'GET' });
    if (!res.ok) throw new Error(`banks.json ${res.status}`);
    const body = (await res.json()) as { data?: Record<string, unknown>[] };
    const rows = Array.isArray(body.data) ? body.data : [];
    const data: BankDTO[] = rows
      .filter((b) => b.bin && b.short_name)
      .map((b) => ({
        bin: String(b.bin),
        code: String(b.code ?? ''),
        shortName: String(b.short_name),
        name: String(b.name ?? b.short_name),
      }));
    banksCache = { at: now, data };
    return data;
  } catch {
    if (banksCache) return banksCache.data; // fetch lỗi nhưng còn cache cũ → dùng tạm
    throw AppError.internal('Không tải được danh sách ngân hàng từ nguồn banks.json');
  }
}

export const settingsService = {
  getBankAccount,
  updateBankAccount,
  listTransactions,
  listBanks,
};
