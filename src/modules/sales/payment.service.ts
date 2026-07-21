import type { Deposit, DepositStatus, Settlement } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { paymentRepository, type DepositWithOrder } from './payment.repository';
import type { ListDepositsQuery, UpdateDepositStatusBody } from './payment.validators';

const OPEN_DEPOSIT_STATUSES: DepositStatus[] = ['PENDING', 'OVERDUE'];
// Chỉ xóa được khoản cọc còn ở trạng thái khởi tạo — SUCCESS/OVERDUE/CANCELLED đều đã có tác động
// nghiệp vụ (đã set orders.payment_status hoặc đã kết thúc vòng đời), không cho xóa để giữ dấu vết.
const DELETABLE_DEPOSIT_STATUSES: DepositStatus[] = ['PENDING'];

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

export interface DepositListItemDTO extends DepositDTO {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  eventName: string | null;
}

export interface DepositListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface DepositListResult {
  data: DepositListItemDTO[];
  meta: DepositListMeta;
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

// eventName fallback theo eventType khi chưa đặt tên sự kiện — khớp cách xử lý đã chốt ở docs/api/
// datcoc_api.md mục 3 (không tự bịa "Lễ cưới {tên khách}" như mock cũ).
function mapDepositListItem(row: DepositWithOrder): DepositListItemDTO {
  return {
    ...mapDeposit(row),
    orderCode: row.order.orderCode,
    customerName: row.order.customer.customerName,
    customerPhone: row.order.customer.phone,
    eventName: row.order.eventName ?? row.order.eventType,
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

// GET /deposits — endpoint gộp toàn hệ thống, gap chính ghi ở docs/api/datcoc_api.md mục 1.2/8 (trước
// đây chỉ có GET /orders/:orderId/deposits, buộc FE phải N+1 để dựng bảng danh sách).
async function listDeposits(query: ListDepositsQuery): Promise<DepositListResult> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const { rows, totalItems } = await paymentRepository.findManyDeposits({
    status: query.status,
    search: query.search,
    skip,
    take: limit,
  });

  return {
    data: rows.map(mapDepositListItem),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
}

// DELETE /deposits/:depositId — chưa có trong đặc tả gốc (docs/api/datcoc_api.md mục 8 ghi "chưa kiểm
// tra, chưa xác nhận có tồn tại hay không"), thêm theo yêu cầu để hỗ trợ luồng "xóa và tạo lại" khi
// ghi nhận cọc sai — chỉ cho phép khi còn PENDING (guard trạng thái, xem ghi chú DELETABLE_DEPOSIT_STATUSES).
async function deleteDeposit(depositId: string): Promise<void> {
  const deposit = await paymentRepository.findDepositById(depositId);
  if (!deposit) throw AppError.notFound('Deposit not found');

  if (!DELETABLE_DEPOSIT_STATUSES.includes(deposit.status)) {
    throw AppError.badRequest(
      `Không thể xóa khoản cọc đang ở trạng thái ${deposit.status} — chỉ xóa được khi đang PENDING`,
    );
  }

  await paymentRepository.deleteDeposit(depositId);
}

export const paymentService = {
  updateDepositStatus,
  confirmSettlement,
  listDeposits,
  deleteDeposit,
};
