import { Request, Response, NextFunction } from 'express';
import { resultManagementService } from '../services/resultManagement.service';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { AuthRequest } from '../middleware/auth';

export const resultManagementController = {
  /**
   * GET /api/students/:hallTicket/results
   */
  async getStudentResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hallTicket } = req.params;
      if (!hallTicket || !hallTicket.trim()) {
        throw ApiError.badRequest('Hall Ticket number is required.');
      }

      // Security check: if an authenticated student is making the request,
      // they may ONLY access their own academic results.
      const authReq = req as AuthRequest;
      if (authReq.user && authReq.user.role === 'student') {
        const loggedInUsername = (authReq.user.username || '').trim().toUpperCase();
        const requestedHallTicket = hallTicket.trim().toUpperCase();
        if (loggedInUsername && loggedInUsername !== requestedHallTicket) {
          throw ApiError.forbidden('Access denied. Students are only authorized to view their own academic results.');
        }
      }

      const data = await resultManagementService.getStudentResultHistory(hallTicket.trim());
      res.status(200).json(ApiResponse.success(data, 'Student examination results retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/examinations/:examinationId/results
   */
  async getExaminationResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { examinationId } = req.params;
      const examId = parseInt(examinationId, 10);
      if (isNaN(examId) || examId <= 0) {
        throw ApiError.badRequest('Invalid examinationId parameter.');
      }

      const { page, limit, search, sectionId, resultStatus } = req.query;

      const data = await resultManagementService.getExaminationResults(examId, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search ? String(search) : undefined,
        sectionId: sectionId ? Number(sectionId) : undefined,
        resultStatus: resultStatus ? String(resultStatus) : undefined,
      });

      res.status(200).json(ApiResponse.success(data, 'Examination results ledger retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },
};
