import { Request, Response, NextFunction } from 'express';
import { studentManagementService } from '../services/studentManagement.service';
import { ApiResponse } from '../utils/ApiResponse';

export const studentManagementController = {
  getStudents: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await studentManagementService.getStudents(req.query);
      res.status(200).json(ApiResponse.success(result, 'Students retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  getStudentById: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const student = await studentManagementService.getStudentProfile(id);
      res.status(200).json(ApiResponse.success(student, 'Student profile retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  getDataStatus: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const counts = await studentManagementService.getDatabaseCounts();
      res.status(200).json(ApiResponse.success(counts, 'Data counts retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },
};
