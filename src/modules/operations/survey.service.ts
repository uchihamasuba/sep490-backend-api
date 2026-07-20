import type { SurveyStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { surveyRepository, type SurveyReportWithDetails } from './survey.repository';
import type { CreateSurveyReportBody, ListSurveyReportsQuery } from './survey.validators';

const CONFIRMABLE_STATUSES: SurveyStatus[] = ['NEEDS_REVIEW', 'SUBMITTED'];

export interface SurveyReportListItemDTO {
  surveyId: string;
  reportCode: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  eventName: string | null;
  surveyDate: string;
  location: string;
  status: SurveyStatus;
  reportedByName: string;
}

export interface SurveyReportDetailDTO extends SurveyReportListItemDTO {
  planId: string | null;
  area: number | null;
  length: number | null;
  width: number | null;
  entrance: string | null;
  siteConstraints: string | null;
  additionalRequests: string | null;
  proposedItems: string | null;
  notes: string | null;
  evidenceId: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyReportListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  counts: { all: number; draft: number; needsReview: number; submitted: number; confirmed: number };
}

function toNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapListItem(row: SurveyReportWithDetails): SurveyReportListItemDTO {
  return {
    surveyId: row.surveyId,
    reportCode: row.reportCode,
    orderId: row.orderId,
    orderCode: row.order.orderCode,
    customerName: row.order.customer.customerName,
    eventName: row.order.eventName,
    surveyDate: row.surveyDate.toISOString(),
    location: row.location,
    status: row.status,
    reportedByName: row.reporter.fullName,
  };
}

function mapDetail(row: SurveyReportWithDetails): SurveyReportDetailDTO {
  return {
    ...mapListItem(row),
    planId: row.planId,
    area: toNumber(row.area),
    length: toNumber(row.length),
    width: toNumber(row.width),
    entrance: row.entrance,
    siteConstraints: row.siteConstraints,
    additionalRequests: row.additionalRequests,
    proposedItems: row.proposedItems,
    notes: row.notes,
    evidenceId: row.evidenceId,
    confirmedByName: row.confirmer?.fullName ?? null,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findSurveyOrThrow(surveyId: string): Promise<SurveyReportWithDetails> {
  const survey = await surveyRepository.findById(surveyId);
  if (!survey) throw AppError.notFound('Survey report not found');
  return survey;
}

async function listSurveyReports(
  query: ListSurveyReportsQuery,
): Promise<{ data: SurveyReportListItemDTO[]; meta: SurveyReportListMeta }> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [{ rows, totalItems }, counts] = await Promise.all([
    surveyRepository.findMany({ search: query.search, status: query.status, skip, take: limit }),
    surveyRepository.countByStatusGlobal(),
  ]);

  return {
    data: rows.map(mapListItem),
    meta: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      counts,
    },
  };
}

async function getSurveyReportById(surveyId: string): Promise<SurveyReportDetailDTO> {
  const survey = await findSurveyOrThrow(surveyId);
  return mapDetail(survey);
}

async function createSurveyReport(body: CreateSurveyReportBody, reportedBy: string): Promise<SurveyReportDetailDTO> {
  const order = await surveyRepository.orderExists(body.orderId);
  if (!order) throw AppError.notFound('Order not found');

  if (body.planId) {
    const plan = await surveyRepository.planExists(body.planId);
    if (!plan) throw AppError.notFound('Schedule plan not found');
  }

  const reportCode = await surveyRepository.generateNextReportCode();
  const created = await surveyRepository.create({
    reportCode,
    orderId: body.orderId,
    planId: body.planId ?? null,
    surveyDate: body.surveyDate,
    location: body.location,
    area: body.area ?? null,
    length: body.length ?? null,
    width: body.width ?? null,
    entrance: body.entrance ?? null,
    siteConstraints: body.siteConstraints ?? null,
    additionalRequests: body.additionalRequests ?? null,
    proposedItems: body.proposedItems ?? null,
    notes: body.notes ?? null,
    evidenceId: body.evidenceId ?? null,
    reportedBy,
  });

  return mapDetail(created);
}

async function confirmSurveyReport(surveyId: string, confirmedBy: string): Promise<SurveyReportDetailDTO> {
  const existing = await findSurveyOrThrow(surveyId);
  if (!CONFIRMABLE_STATUSES.includes(existing.status)) {
    throw AppError.badRequest(
      `Chỉ có thể xác nhận báo cáo đang ở trạng thái NEEDS_REVIEW/SUBMITTED (hiện tại: ${existing.status})`,
    );
  }

  const confirmed = await surveyRepository.confirm(surveyId, confirmedBy);
  return mapDetail(confirmed);
}

export const surveyService = {
  listSurveyReports,
  getSurveyReportById,
  createSurveyReport,
  confirmSurveyReport,
};
