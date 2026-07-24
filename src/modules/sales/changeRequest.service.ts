import { AppError } from '../../utils/AppError';
import { changeRequestRepository, type ChangeRequestWithDetails } from './changeRequest.repository';
import type { ApproveChangeRequestBody, ListChangeRequestsQuery } from './changeRequest.validators';

export interface ChangeRequestItemDTO {
  changeRequestItemId: string;
  catalogItemId: string;
  itemName: string;
  quantity: number;
  action: string;
  rentalPrice: number;
}

export interface ChangeRequestDTO {
  changeRequestId: string;
  orderId: string;
  orderCode: string;
  eventName: string | null;
  customerName: string;
  customerPhone: string;
  type: string;
  status: string;
  amount: number;
  createdAt: string;
  items: ChangeRequestItemDTO[];
}

export interface ChangeRequestListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface ChangeRequestListResult {
  data: ChangeRequestDTO[];
  meta: ChangeRequestListMeta;
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

// Không có cột `amount` lưu sẵn trên change_requests — tính từ items + giá `Item.rentalPrice` HIỆN TẠI
// mỗi lần đọc/duyệt. Công thức gộp đúng cả 3 type: add-only toàn cộng, remove-only toàn trừ, replace (1
// add + 1 remove) tự bù trừ thành "cũ trừ, mới cộng".
function computeAmount(items: ChangeRequestWithDetails['items']): number {
  return items.reduce((sum, item) => {
    const lineValue = item.quantity * toNumber(item.catalogItem.rentalPrice);
    return item.action === 'add' ? sum + lineValue : sum - lineValue;
  }, 0);
}

export function mapChangeRequest(row: ChangeRequestWithDetails): ChangeRequestDTO {
  return {
    changeRequestId: row.changeRequestId,
    orderId: row.orderId,
    orderCode: row.order.orderCode,
    eventName: row.order.eventName ?? row.order.eventType,
    customerName: row.order.customer.customerName,
    customerPhone: row.order.customer.phone,
    type: row.type,
    status: row.status,
    amount: computeAmount(row.items),
    createdAt: row.createdAt.toISOString(),
    items: row.items.map((item) => ({
      changeRequestItemId: item.changeRequestItemId,
      catalogItemId: item.catalogItemId,
      itemName: item.catalogItem.itemName,
      quantity: item.quantity,
      action: item.action,
      rentalPrice: toNumber(item.catalogItem.rentalPrice),
    })),
  };
}

async function listChangeRequests(query: ListChangeRequestsQuery): Promise<ChangeRequestListResult> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const { rows, totalItems } = await changeRequestRepository.findMany({
    status: query.status,
    orderId: query.orderId,
    skip,
    take: limit,
  });

  return {
    data: rows.map(mapChangeRequest),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
}

// PUT /change-requests/:changeRequestId/approve — Manager duyệt/từ chối. Chỉ xử lý được request đang
// pending (không cho duyệt/từ chối lại 1 request đã có kết quả). Không có cột lưu amount/approvedBy —
// chỉ đổi status, amount luôn được tính lại on-the-fly khi đọc (xem computeAmount).
async function approveChangeRequest(changeRequestId: string, body: ApproveChangeRequestBody): Promise<ChangeRequestDTO> {
  const changeRequest = await changeRequestRepository.findById(changeRequestId);
  if (!changeRequest) throw AppError.notFound('Change request not found');

  if (changeRequest.status !== 'pending') {
    throw AppError.badRequest(
      `Yêu cầu thay đổi đang ở trạng thái ${changeRequest.status}, chỉ duyệt được khi đang pending`,
    );
  }

  const updated = await changeRequestRepository.updateStatus(changeRequestId, body.status);
  return mapChangeRequest(updated);
}

// Dùng ở order.service.ts (createSettlement) để cộng dồn vào finalAmount — tổng amount (tính on-the-fly)
// của mọi ChangeRequest đã approved thuộc đơn, luôn tính lại từ đầu mỗi lần gọi (không delta).
async function sumApprovedAmount(orderId: string): Promise<number> {
  const rows = await changeRequestRepository.findApprovedByOrderId(orderId);
  return rows.reduce((sum, row) => sum + computeAmount(row.items), 0);
}

export const changeRequestService = {
  listChangeRequests,
  approveChangeRequest,
  sumApprovedAmount,
};
