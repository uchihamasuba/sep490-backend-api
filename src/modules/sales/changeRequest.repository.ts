import type { ChangeRequestItemAction, ChangeRequestStatus, ChangeRequestType, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface ChangeRequestItemInput {
  catalogItemId: string;
  quantity: number;
  action: ChangeRequestItemAction;
}

export interface ChangeRequestListFilter {
  status?: ChangeRequestStatus;
  orderId?: string;
}

export interface ChangeRequestListParams extends ChangeRequestListFilter {
  skip: number;
  take: number;
}

const changeRequestDetailInclude = {
  order: {
    select: {
      orderCode: true,
      eventName: true,
      eventType: true,
      customer: { select: { customerName: true, phone: true } },
    },
  },
  items: {
    include: {
      catalogItem: { select: { itemId: true, itemName: true, rentalPrice: true } },
    },
  },
} satisfies Prisma.ChangeRequestInclude;

export type ChangeRequestWithDetails = Prisma.ChangeRequestGetPayload<{ include: typeof changeRequestDetailInclude }>;

function buildWhere(filter: ChangeRequestListFilter): Prisma.ChangeRequestWhereInput {
  const where: Prisma.ChangeRequestWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.orderId) where.orderId = filter.orderId;
  return where;
}

export const changeRequestRepository = {
  create(orderId: string, type: ChangeRequestType, items: ChangeRequestItemInput[]): Promise<ChangeRequestWithDetails> {
    return prisma.changeRequest.create({
      data: {
        orderId,
        type,
        items: { create: items.map((item) => ({ ...item })) },
      },
      include: changeRequestDetailInclude,
    });
  },

  findById(changeRequestId: string): Promise<ChangeRequestWithDetails | null> {
    return prisma.changeRequest.findUnique({
      where: { changeRequestId },
      include: changeRequestDetailInclude,
    });
  },

  async findMany(params: ChangeRequestListParams) {
    const where = buildWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.changeRequest.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: changeRequestDetailInclude,
      }),
      prisma.changeRequest.count({ where }),
    ]);
    return { rows, totalItems };
  },

  updateStatus(changeRequestId: string, status: ChangeRequestStatus): Promise<ChangeRequestWithDetails> {
    return prisma.changeRequest.update({
      where: { changeRequestId },
      data: { status },
      include: changeRequestDetailInclude,
    });
  },

  // Không có cột `amount` lưu sẵn trên change_requests — lấy toàn bộ change request đã approved kèm
  // items+giá hiện tại để service tự tính tổng phát sinh lúc gộp vào settlement (xem
  // changeRequest.service.ts computeApprovedTotal).
  findApprovedByOrderId(orderId: string): Promise<ChangeRequestWithDetails[]> {
    return prisma.changeRequest.findMany({
      where: { orderId, status: 'approved' },
      include: changeRequestDetailInclude,
    });
  },
};
