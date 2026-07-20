import type { Prisma, SurveyStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface SurveyReportListFilter {
  search?: string;
  status?: SurveyStatus;
}

export interface SurveyReportListParams extends SurveyReportListFilter {
  skip: number;
  take: number;
}

const detailInclude = {
  order: { select: { orderCode: true, eventName: true, customer: { select: { customerName: true } } } },
  reporter: { select: { userId: true, fullName: true } },
  confirmer: { select: { userId: true, fullName: true } },
} satisfies Prisma.SurveyReportInclude;

export type SurveyReportWithDetails = Prisma.SurveyReportGetPayload<{ include: typeof detailInclude }>;

function buildWhere(filter: SurveyReportListFilter): Prisma.SurveyReportWhereInput {
  const where: Prisma.SurveyReportWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    const q = filter.search;
    where.OR = [
      { reportCode: { contains: q } },
      { location: { contains: q } },
      { order: { orderCode: { contains: q } } },
      { order: { customer: { customerName: { contains: q } } } },
    ];
  }
  return where;
}

export const surveyRepository = {
  async findMany(params: SurveyReportListParams) {
    const where = buildWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.surveyReport.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { surveyDate: 'desc' },
        include: detailInclude,
      }),
      prisma.surveyReport.count({ where }),
    ]);
    return { rows, totalItems };
  },

  // Đúng 4 giá trị thật đã chốt ở docs/api/khaosathientruong_api.md mục 2 — SUBMITTED tạm gộp cùng
  // NEEDS_REVIEW ở tầng hiển thị (FE), backend vẫn đếm riêng từng giá trị enum.
  async countByStatusGlobal() {
    const [all, draft, needsReview, submitted, confirmed] = await Promise.all([
      prisma.surveyReport.count(),
      prisma.surveyReport.count({ where: { status: 'DRAFT' } }),
      prisma.surveyReport.count({ where: { status: 'NEEDS_REVIEW' } }),
      prisma.surveyReport.count({ where: { status: 'SUBMITTED' } }),
      prisma.surveyReport.count({ where: { status: 'CONFIRMED' } }),
    ]);
    return { all, draft, needsReview, submitted, confirmed };
  },

  findById(surveyId: string): Promise<SurveyReportWithDetails | null> {
    return prisma.surveyReport.findUnique({ where: { surveyId }, include: detailInclude });
  },

  async generateNextReportCode(): Promise<string> {
    const count = await prisma.surveyReport.count();
    return `SUR-${String(count + 1).padStart(3, '0')}`;
  },

  orderExists(orderId: string) {
    return prisma.order.findUnique({ where: { orderId }, select: { orderId: true } });
  },

  planExists(planId: string) {
    return prisma.schedulePlan.findUnique({ where: { planId }, select: { planId: true } });
  },

  create(data: {
    reportCode: string;
    orderId: string;
    planId: string | null;
    surveyDate: Date;
    location: string;
    area: number | null;
    length: number | null;
    width: number | null;
    entrance: string | null;
    siteConstraints: string | null;
    additionalRequests: string | null;
    proposedItems: string | null;
    notes: string | null;
    evidenceId: string | null;
    reportedBy: string;
  }): Promise<SurveyReportWithDetails> {
    return prisma.surveyReport.create({
      data: { ...data, status: 'NEEDS_REVIEW' },
      include: detailInclude,
    });
  },

  confirm(surveyId: string, confirmedBy: string): Promise<SurveyReportWithDetails> {
    return prisma.surveyReport.update({
      where: { surveyId },
      data: { status: 'CONFIRMED', confirmedBy, confirmedAt: new Date() },
      include: detailInclude,
    });
  },
};
