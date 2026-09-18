import { academicStructureRepository } from '../repositories/academicStructure.repository';
import {
  IDepartment,
  IProgram,
  IAcademicBatch,
  ISection,
  IAcademicSession,
  IPgSemester,
} from '../interfaces/db.interface';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export const academicStructureService = {
  getDepartments: async (): Promise<IDepartment[]> => {
    try {
      return await academicStructureRepository.getDepartments();
    } catch (error) {
      logger.error('Error fetching departments:', error);
      throw ApiError.internal('Failed to retrieve departments');
    }
  },

  getPrograms: async (departmentId?: string): Promise<IProgram[]> => {
    try {
      let deptIdNum: number | undefined;
      if (departmentId) {
        deptIdNum = Number(departmentId);
        if (isNaN(deptIdNum)) {
          throw ApiError.badRequest('Invalid departmentId parameter; must be numeric');
        }
      }
      return await academicStructureRepository.getPrograms(deptIdNum);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error fetching programs:', error);
      throw ApiError.internal('Failed to retrieve programs');
    }
  },

  getAcademicBatches: async (programId?: string): Promise<IAcademicBatch[]> => {
    try {
      let progIdNum: number | undefined;
      if (programId) {
        progIdNum = Number(programId);
        if (isNaN(progIdNum)) {
          throw ApiError.badRequest('Invalid programId parameter; must be numeric');
        }
      }
      return await academicStructureRepository.getAcademicBatches(progIdNum);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error fetching academic batches:', error);
      throw ApiError.internal('Failed to retrieve academic batches');
    }
  },

  getSections: async (batchId?: string): Promise<ISection[]> => {
    try {
      let batchIdNum: number | undefined;
      if (batchId) {
        batchIdNum = Number(batchId);
        if (isNaN(batchIdNum)) {
          throw ApiError.badRequest('Invalid batchId parameter; must be numeric');
        }
      }
      return await academicStructureRepository.getSections(batchIdNum);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error fetching sections:', error);
      throw ApiError.internal('Failed to retrieve sections');
    }
  },

  getAcademicSessions: async (isActive?: string): Promise<IAcademicSession[]> => {
    try {
      let activeBool: boolean | undefined;
      if (isActive !== undefined) {
        activeBool = isActive === 'true' || isActive === '1';
      }
      return await academicStructureRepository.getAcademicSessions(activeBool);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error fetching academic sessions:', error);
      throw ApiError.internal('Failed to retrieve academic sessions');
    }
  },

  getSemesters: async (): Promise<IPgSemester[]> => {
    try {
      return await academicStructureRepository.getSemesters();
    } catch (error) {
      logger.error('Error fetching semesters:', error);
      throw ApiError.internal('Failed to retrieve semesters');
    }
  },
};
