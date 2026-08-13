import type { Request, Response } from 'express';
import { reportService } from './report.service';
import type { GetRevenueReportQuery } from './report.validators';

export const reportController = {
  async getRevenueReport(req: Request<unknown, unknown, unknown, GetRevenueReportQuery>, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const report = await reportService.getRevenueReport(startDate, endDate);
      
      return res.json({ success: true, data: report });
    } catch (error) {
      console.error('[reportController.getRevenueReport]', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
};
