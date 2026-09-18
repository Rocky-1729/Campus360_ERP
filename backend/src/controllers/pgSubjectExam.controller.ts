import { Request, Response, NextFunction } from 'express';
import { pgSubjectExamService } from '../services/pgSubjectExam.service';
import { ApiResponse } from '../utils/ApiResponse';

export const pgSubjectExamController = {
  getSubjects: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subjects = await pgSubjectExamService.getSubjects(req.query);
      res.status(200).json(ApiResponse.success(subjects, 'Subjects retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  getCurriculumSubjects: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const curriculum = await pgSubjectExamService.getCurriculumSubjects(req.query);
      res.status(200).json(ApiResponse.success(curriculum, 'Curriculum subjects retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  getExaminations: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const examinations = await pgSubjectExamService.getExaminations(req.query);
      res.status(200).json(ApiResponse.success(examinations, 'Examinations retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  createExamination: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const examination = await pgSubjectExamService.createExamination(req.body);
      res.status(201).json(ApiResponse.success(examination, 'Examination created successfully'));
    } catch (error) {
      next(error);
    }
  },

  getTableCounts: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const counts = await pgSubjectExamService.getTableCounts();
      res.status(200).json(ApiResponse.success(counts, 'Table counts retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },
};
