import { pgSubjectExamRepository } from '../repositories/pgSubjectExam.repository';
import {
  ISubjectListItem,
  ICurriculumSubjectView,
  IExaminationView,
} from '../interfaces/db.interface';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export const pgSubjectExamService = {
  getSubjects: async (query: Record<string, any>): Promise<ISubjectListItem[]> => {
    try {
      const filters: {
        search?: string;
        semesterId?: number;
        programId?: number;
        batchId?: number;
      } = {};

      if (query.search && typeof query.search === 'string') {
        filters.search = query.search.trim();
      }

      if (query.semesterId !== undefined && query.semesterId !== '') {
        const val = Number(query.semesterId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid semesterId parameter; must be a positive integer');
        }
        filters.semesterId = val;
      }

      if (query.programId !== undefined && query.programId !== '') {
        const val = Number(query.programId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid programId parameter; must be a positive integer');
        }
        filters.programId = val;
      }

      if (query.batchId !== undefined && query.batchId !== '') {
        const val = Number(query.batchId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid batchId parameter; must be a positive integer');
        }
        filters.batchId = val;
      }

      return await pgSubjectExamRepository.findSubjects(filters);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error fetching subjects:', error);
      throw ApiError.internal('Failed to retrieve subjects');
    }
  },

  getCurriculumSubjects: async (query: Record<string, any>): Promise<ICurriculumSubjectView[]> => {
    try {
      const filters: {
        batchId?: number;
        semesterId?: number;
        programId?: number;
      } = {};

      if (query.batchId !== undefined && query.batchId !== '') {
        const val = Number(query.batchId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid batchId parameter; must be a positive integer');
        }
        filters.batchId = val;
      }

      if (query.semesterId !== undefined && query.semesterId !== '') {
        const val = Number(query.semesterId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid semesterId parameter; must be a positive integer');
        }
        filters.semesterId = val;
      }

      if (query.programId !== undefined && query.programId !== '') {
        const val = Number(query.programId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid programId parameter; must be a positive integer');
        }
        filters.programId = val;
      }

      return await pgSubjectExamRepository.findCurriculumSubjects(filters);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error fetching curriculum subjects:', error);
      throw ApiError.internal('Failed to retrieve curriculum subjects');
    }
  },

  getExaminations: async (query: Record<string, any>): Promise<IExaminationView[]> => {
    try {
      const filters: {
        academicSessionId?: number;
        semesterId?: number;
        examinationType?: string;
        status?: string;
      } = {};

      if (query.academicSessionId !== undefined && query.academicSessionId !== '') {
        const val = Number(query.academicSessionId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid academicSessionId parameter; must be a positive integer');
        }
        filters.academicSessionId = val;
      }

      if (query.semesterId !== undefined && query.semesterId !== '') {
        const val = Number(query.semesterId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid semesterId parameter; must be a positive integer');
        }
        filters.semesterId = val;
      }

      if (query.examinationType && typeof query.examinationType === 'string') {
        const typeUpper = query.examinationType.trim().toUpperCase();
        if (!['REGULAR', 'SUPPLEMENTARY'].includes(typeUpper)) {
          throw ApiError.badRequest('Invalid examinationType parameter; must be either REGULAR or SUPPLEMENTARY');
        }
        filters.examinationType = typeUpper;
      }

      if (query.status && typeof query.status === 'string') {
        const statusUpper = query.status.trim().toUpperCase();
        if (!['DRAFT', 'COMPLETED', 'CANCELLED'].includes(statusUpper)) {
          throw ApiError.badRequest('Invalid status parameter; must be DRAFT, COMPLETED, or CANCELLED');
        }
        filters.status = statusUpper;
      }

      return await pgSubjectExamRepository.findExaminations(filters);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error fetching examinations:', error);
      throw ApiError.internal('Failed to retrieve examinations');
    }
  },

  createExamination: async (body: Record<string, any>): Promise<IExaminationView> => {
    try {
      if (!body.examName || typeof body.examName !== 'string' || !body.examName.trim()) {
        throw ApiError.badRequest('examName is required and must be a non-empty string');
      }

      if (body.academicSessionId === undefined || body.academicSessionId === '') {
        throw ApiError.badRequest('academicSessionId is required');
      }
      const sessionId = Number(body.academicSessionId);
      if (isNaN(sessionId) || sessionId <= 0 || !Number.isInteger(sessionId)) {
        throw ApiError.badRequest('academicSessionId must be a positive integer');
      }

      if (body.semesterId === undefined || body.semesterId === '') {
        throw ApiError.badRequest('semesterId is required');
      }
      const semesterId = Number(body.semesterId);
      if (isNaN(semesterId) || semesterId <= 0 || !Number.isInteger(semesterId)) {
        throw ApiError.badRequest('semesterId must be a positive integer');
      }

      if (!body.examType || typeof body.examType !== 'string') {
        throw ApiError.badRequest('examType is required (REGULAR or SUPPLEMENTARY)');
      }
      const examType = body.examType.trim().toUpperCase();
      if (!['REGULAR', 'SUPPLEMENTARY'].includes(examType)) {
        throw ApiError.badRequest('examType must be either REGULAR or SUPPLEMENTARY');
      }

      let status = 'COMPLETED';
      if (body.status && typeof body.status === 'string') {
        const s = body.status.trim().toUpperCase();
        if (!['DRAFT', 'COMPLETED', 'CANCELLED'].includes(s)) {
          throw ApiError.badRequest('status must be DRAFT, COMPLETED, or CANCELLED');
        }
        status = s;
      }

      let examDate: string | null = null;
      if (body.examDate) {
        if (typeof body.examDate !== 'string') {
          throw ApiError.badRequest('examDate must be a valid date string');
        }
        examDate = body.examDate.trim();
      }

      return await pgSubjectExamRepository.createExamination({
        examName: body.examName.trim(),
        academicSessionId: sessionId,
        semesterId,
        examType: examType as 'REGULAR' | 'SUPPLEMENTARY',
        examDate,
        status,
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error creating examination:', error);
      throw ApiError.internal('Failed to create examination');
    }
  },

  getTableCounts: async () => {
    return await pgSubjectExamRepository.getCounts();
  },
};
