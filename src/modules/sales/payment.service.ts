import type { Deposit, DepositStatus, Settlement } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { paymentRepository } from './payment.repository';
import type { UpdateDepositStatusBody } from './payment.validators';

const OPEN_DEPOSIT_STATUSES: DepositStatus[] = ['PENDING', 'OVERDUE'];

export interface DepositDTO {
  depositId: string;
  depositCode: string;
  orderId: string;
  amount: number;
  dueDate: string | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  qrCodeUrl: string | null;
  status: string;
  evidenceId: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementDTO {
  settlementId: string;
  orderId: string;
  additionalFee: number;
  compensation: number;
  discount: number;
  finalAmount: number;
  paymentMethod: string | null;
  qrCodeUrl: string | null;
  paidAt: string | null;
  evidenceId: string | null;
  status: string;
  requestedBy: string | null;
  requestedAt: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function mapDeposit(row: Deposit): DepositDTO {
  return {
    depositId: row.depositId,
    depositCode: row.depositCode,
    orderId: row.orderId,
    amount: toNumber(row.amount),
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    paymentDate: row.paymentDate ? row.paymentDate.toISOString() : null,
    paymentMethod: row.paymentMethod,
    qrCodeUrl: row.qrCodeUrl,
    status: row.status,
    evidenceId: row.evidenceId,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSettlement(row: Settlement): SettlementDTO {
  return {
    settlementId: row.settlementId,
    orderId: row.orderId,
    additionalFee: toNumber(row.additionalFee),
    compensation: toNumber(row.compensation),
    discount: toNumber(row.discount),
    finalAmount: toNumber(row.finalAmount),
    paymentMethod: row.paymentMethod,
    qrCodeUrl: row.qrCodeUrl,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    evidenceId: row.evidenceId,
    status: row.status,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt ? row.requestedAt.toISOString() : null,
    confirmedBy: row.confirmedBy,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// PUT /deposits/:depositId — docs/api/tiendosukien_api.md mục 3.1: nút "Xác nhận đã nhận cọc 50%".
// Chỉ tác động được lên khoản cọc đang PENDING/OVERDUE — SUCCESS/CANCELLED là trạng thái cuối, không
// cho sửa lại qua endpoint này (tránh xác nhận nhầm 2 lần hoặc hồi sinh 1 khoản đã hủy).
async function updateDepositStatus(depositId: string, body: UpdateDepositStatusBody, actorId: string): Promise<DepositDTO> {
  const deposit = await paymentRepository.findDepositById(depositId);
  if (!deposit) throw AppError.notFound('Deposit not found');

  if (!OPEN_DEPOSIT_STATUSES.includes(deposit.status)) {
    throw AppError.badRequest(`Khoản cọc đang ở trạng thái ${deposit.status} (đã kết thúc), không thể cập nhật thêm`);
  }

  const updated = await paymentRepository.updateStatus(depositId, deposit.orderId, body.status, actorId);
  return mapDeposit(updated);
}

// PUT /settlements/:settlementId/confirm — docs/api/tiendosukien_api.md mục 6, bước 3: "Xác nhận thu
// nốt & Quyết toán". FE tự gọi tiếp PUT /orders/:id/status { COMPLETED } sau bước này (đã chốt mục 6
// bước 4) — không tự cascade cập nhật Order ở đây.
async function confirmSettlement(settlementId: string, confirmedBy: string): Promise<SettlementDTO> {
  const settlement = await paymentRepository.findSettlementById(settlementId);
  if (!settlement) throw AppError.notFound('Settlement not found');

  if (settlement.status === 'CONFIRMED') {
    throw AppError.badRequest('Bản quyết toán này đã được xác nhận trước đó');
  }

  const updated = await paymentRepository.confirmSettlement(settlementId, confirmedBy);
  return mapSettlement(updated);
}

export const paymentService = {
  updateDepositStatus,
  confirmSettlement,
};
