import { Request, Response, NextFunction } from 'express';
import { academicStructureService } from '../services/academicStructure.service';
import { ApiResponse } from '../utils/ApiResponse';

export const academicStructureController = {
  getDepartments: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const departments = await academicStructureService.getDepartments();
      res.status(200).json(ApiResponse.success(departments, 'Departments retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  getPrograms: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { departmentId } = req.query;
      const programs = await academicStructureService.getPrograms(
        departmentId ? String(departmentId) : undefined
      );
      res.status(200).json(ApiResponse.success(programs, 'Programs retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  getAcademicBatches: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { programId } = req.query;
      const batches = await academicStructureService.getAcademicBatches(
        programId ? String(programId) : undefined
      );
      res.status(200).json(ApiResponse.success(batches, 'Academic batches retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  getSections: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { batchId } = req.query;
      const sections = await academicStructureService.getSections(
        batchId ? String(batchId) : undefined
      );
      res.status(200).json(ApiResponse.success(sections, 'Sections retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  getAcademicSessions: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { isActive } = req.query;
      const sessions = await academicStructureService.getAcademicSessions(
        isActive !== undefined ? String(isActive) : undefined
      );
      res.status(200).json(ApiResponse.success(sessions, 'Academic sessions retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  getSemesters: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const semesters = await academicStructureService.getSemesters();
      res.status(200).json(ApiResponse.success(semesters, 'Semesters retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },
};
