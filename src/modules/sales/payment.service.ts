import type { Deposit, DepositStatus, Settlement } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { scheduleRepository } from '../operations/schedule.repository';
import type { Actor } from '../operations/schedule.service';
import { paymentRepository, type DepositWithOrder } from './payment.repository';
import { orderRepository } from './order.repository';
import { notificationService } from '../shared/notification.service';
import type { ListDepositsQuery, MarkSettlementPaidBody, UpdateDepositStatusBody } from './payment.validators';

const OPEN_DEPOSIT_STATUSES: DepositStatus[] = ['UNPAID'];
// Chỉ xóa được khoản cọc còn ở trạng thái khởi tạo — PAID/CANCELLED đều đã có tác động nghiệp vụ (đã
// set orders.payment_status hoặc đã kết thúc vòng đời), không cho xóa để giữ dấu vết.
const DELETABLE_DEPOSIT_STATUSES: DepositStatus[] = ['UNPAID'];

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
  evidenceIds: string[];
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
  evidenceIds: string[];
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
    evidenceIds: (row as any).evidences ? (row as any).evidences.map((e: any) => e.evidenceId) : [],
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
    evidenceIds: (row as any).evidences ? (row as any).evidences.map((e: any) => e.evidenceId) : [],
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
// Chỉ tác động được lên khoản cọc đang UNPAID — PAID/CANCELLED là trạng thái cuối, không cho sửa lại
// qua endpoint này (tránh xác nhận nhầm 2 lần hoặc hồi sinh 1 khoản đã hủy).
async function updateDepositStatus(depositId: string, body: UpdateDepositStatusBody, actorId: string): Promise<DepositDTO> {
  const deposit = await paymentRepository.findDepositById(depositId);
  if (!deposit) throw AppError.notFound('Không tìm thấy khoản cọc');

  if (!OPEN_DEPOSIT_STATUSES.includes(deposit.status)) {
    throw AppError.badRequest(`Khoản cọc đang ở trạng thái ${deposit.status} (đã kết thúc), không thể cập nhật thêm`);
  }

  const updated = await paymentRepository.updateStatus(depositId, deposit.orderId, body.status, actorId, body.evidenceIds);
  return mapDeposit(updated);
}

// PUT /settlements/:settlementId/confirm — docs/api/tiendosukien_api.md mục 6, bước 3: "Xác nhận thu
// nốt & Quyết toán". FE tự gọi tiếp PUT /orders/:id/status { COMPLETED } sau bước này (đã chốt mục 6
// bước 4) — không tự cascade cập nhật Order ở đây.
async function confirmSettlement(settlementId: string, confirmedBy: string, evidenceIds?: string[]): Promise<SettlementDTO> {
  const settlement = await paymentRepository.findSettlementById(settlementId);
  if (!settlement) throw AppError.notFound('Không tìm thấy bản quyết toán');

  if (settlement.status === 'PAID') {
    throw AppError.badRequest('Bản quyết toán này đã được xác nhận trước đó');
  }

  const updated = await paymentRepository.confirmSettlement(settlementId, settlement.orderId, confirmedBy, evidenceIds);
  // Quyết toán → PAID: có thể là điều kiện cuối để tự hoàn thành đơn (nếu mọi lịch đã xong). No-op nếu chưa đủ.
  const completion = await orderRepository.maybeCompleteOrder(settlement.orderId);
  if (completion.completed) {
    void notificationService.broadcastToPrivilegedUsers(
      'Đơn hàng hoàn thành',
      `Đơn ${completion.orderCode ?? ''} đã hoàn thành`,
      'ORDER',
      settlement.orderId,
      'ORDER',
    );
  }
  return mapSettlement(updated);
}

// PUT /settlements/:settlementId/mark-paid — docs/api/api.md gap (n): Leader xác nhận đã thu tiền tại
// hiện trường kèm ảnh, chuyển UNPAID -> PAID. Chỉ hợp lệ từ đúng trạng thái UNPAID; PAID/CANCELLED đã
// là trạng thái cuối.
async function markSettlementPaid(settlementId: string, body: MarkSettlementPaidBody, actor: Actor): Promise<SettlementDTO> {
  const settlement = await paymentRepository.findSettlementById(settlementId);
  if (!settlement) throw AppError.notFound('Không tìm thấy bản quyết toán');

  if (settlement.status !== 'UNPAID') {
    throw AppError.badRequest(`Bản quyết toán đang ở trạng thái ${settlement.status}, chỉ chuyển được PAID từ UNPAID`);
  }

  if (actor.role === 'STAFF') {
    const isLead = await scheduleRepository.isUserLeadOnOrder(actor.id, settlement.orderId);
    if (!isLead) {
      throw AppError.forbidden('Chỉ Leader giữ vai trò LEAD trong kế hoạch của đơn hàng này mới được xác nhận đã thu tiền');
    }
  }

  const updated = await paymentRepository.markSettlementPaid(settlementId, body.evidenceIds!, settlement.orderId);
  // Leader thu tiền tại hiện trường → settlement PAID: thử tự hoàn thành đơn nếu mọi lịch đã xong.
  const completion = await orderRepository.maybeCompleteOrder(settlement.orderId);
  // Báo Manager/Admin có quyết toán vừa được Leader ghi nhận tại hiện trường, chờ xác nhận (hàng đợi).
  void notificationService.broadcastToPrivilegedUsers(
    'Quyết toán ghi nhận tại hiện trường',
    'Leader vừa ghi nhận đã thu tiền quyết toán một đơn hàng — chờ Manager xác nhận',
    'PAYMENT',
    settlement.orderId,
    'ORDER',
  );
  if (completion.completed) {
    void notificationService.broadcastToPrivilegedUsers(
      'Đơn hàng hoàn thành',
      `Đơn ${completion.orderCode ?? ''} đã hoàn thành`,
      'ORDER',
      settlement.orderId,
      'ORDER',
    );
  }
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
// ghi nhận cọc sai — chỉ cho phép khi còn UNPAID (guard trạng thái, xem ghi chú DELETABLE_DEPOSIT_STATUSES).
async function deleteDeposit(depositId: string): Promise<void> {
  const deposit = await paymentRepository.findDepositById(depositId);
  if (!deposit) throw AppError.notFound('Không tìm thấy khoản cọc');

  if (!DELETABLE_DEPOSIT_STATUSES.includes(deposit.status)) {
    throw AppError.badRequest(
      `Không thể xóa khoản cọc đang ở trạng thái ${deposit.status} — chỉ xóa được khi đang UNPAID`,
    );
  }

  await paymentRepository.deleteDeposit(depositId);
}

export const paymentService = {
  updateDepositStatus,
  confirmSettlement,
  markSettlementPaid,
  listDeposits,
  deleteDeposit,
};
