import { Request, Response, NextFunction } from 'express';
import { pgAnalyticsService } from '../services/pgAnalytics.service';
import { ApiResponse } from '../utils/ApiResponse';

export const pgAnalyticsController = {
  /**
   * GET /api/analytics/overview
   */
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pgAnalyticsService.getOverviewAnalytics(req.query);
      res.status(200).json(ApiResponse.success(data, 'Overview analytics retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/departments
   */
  async getDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pgAnalyticsService.getDepartmentAnalytics(req.query);
      res.status(200).json(ApiResponse.success(data, 'Department analytics retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/examinations/:id/performance
   */
  async getExaminationPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pgAnalyticsService.getExaminationPerformance(req.params.id);
      res.status(200).json(ApiResponse.success(data, 'Examination performance retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },
};
