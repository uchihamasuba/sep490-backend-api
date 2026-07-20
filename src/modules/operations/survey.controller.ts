import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { created, ok } from '../../utils/response';
import { surveyService } from './survey.service';
import type { CreateSurveyReportBody, ListSurveyReportsQuery, SurveyIdParam } from './survey.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListSurveyReportsQuery;
  const result = await surveyService.listSurveyReports(query);
  ok(res, result.data, { ...result.meta });
}

async function getById(req: Request, res: Response) {
  const { surveyId } = req.params as unknown as SurveyIdParam;
  const survey = await surveyService.getSurveyReportById(surveyId);
  ok(res, survey);
}

async function create(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const body = req.body as CreateSurveyReportBody;
  const survey = await surveyService.createSurveyReport(body, req.user.id);
  created(res, survey);
}

async function confirm(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const { surveyId } = req.params as unknown as SurveyIdParam;
  const survey = await surveyService.confirmSurveyReport(surveyId, req.user.id);
  ok(res, survey);
}

export const surveyController = {
  list,
  getById,
  create,
  confirm,
};
