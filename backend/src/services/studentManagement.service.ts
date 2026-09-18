import { pgStudentRepository } from '../repositories/pgStudent.repository';
import { IStudentListItem, IStudentProfileDetails, IStudentListFilters } from '../interfaces/db.interface';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export const studentManagementService = {
  getStudents: async (
    queryFilters: Record<string, any>
  ): Promise<{ students: IStudentListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    try {
      const parsedFilters: IStudentListFilters = {};

      // Search parameter
      if (queryFilters.search && typeof queryFilters.search === 'string') {
        parsedFilters.search = queryFilters.search.trim();
      }

      // Department ID validation
      if (queryFilters.departmentId !== undefined && queryFilters.departmentId !== '') {
        const val = Number(queryFilters.departmentId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid departmentId parameter; must be a positive integer');
        }
        parsedFilters.departmentId = val;
      }

      // Program ID validation
      if (queryFilters.programId !== undefined && queryFilters.programId !== '') {
        const val = Number(queryFilters.programId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid programId parameter; must be a positive integer');
        }
        parsedFilters.programId = val;
      }

      // Batch ID validation
      if (queryFilters.batchId !== undefined && queryFilters.batchId !== '') {
        const val = Number(queryFilters.batchId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid batchId parameter; must be a positive integer');
        }
        parsedFilters.batchId = val;
      }

      // Section ID validation
      if (queryFilters.sectionId !== undefined && queryFilters.sectionId !== '') {
        const val = Number(queryFilters.sectionId);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid sectionId parameter; must be a positive integer');
        }
        parsedFilters.sectionId = val;
      }

      // Status parameter
      if (queryFilters.status && typeof queryFilters.status === 'string') {
        parsedFilters.status = queryFilters.status.trim();
      }

      // Pagination page
      if (queryFilters.page !== undefined && queryFilters.page !== '') {
        const val = Number(queryFilters.page);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid page parameter; must be a positive integer');
        }
        parsedFilters.page = val;
      } else {
        parsedFilters.page = 1;
      }

      // Pagination limit
      if (queryFilters.limit !== undefined && queryFilters.limit !== '') {
        const val = Number(queryFilters.limit);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          throw ApiError.badRequest('Invalid limit parameter; must be a positive integer');
        }
        parsedFilters.limit = val;
      } else {
        parsedFilters.limit = 20;
      }

      const res = await pgStudentRepository.findStudents(parsedFilters);

      return {
        students: res.students,
        pagination: {
          page: res.page,
          limit: res.limit,
          total: res.total,
          totalPages: res.totalPages,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error fetching students:', error);
      throw ApiError.internal('Failed to retrieve students');
    }
  },

  getStudentProfile: async (identifier: string): Promise<IStudentProfileDetails> => {
    try {
      if (!identifier || !identifier.trim()) {
        throw ApiError.badRequest('Student identifier is required');
      }

      const student = await pgStudentRepository.findStudentById(identifier.trim());
      if (!student) {
        throw ApiError.notFound(`Student with identifier "${identifier}" not found`);
      }

      return student;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error(`Error fetching student profile for "${identifier}":`, error);
      throw ApiError.internal('Failed to retrieve student profile');
    }
  },

  getDatabaseCounts: async (): Promise<{ students: number; enrollments: number }> => {
    try {
      const [students, enrollments] = await Promise.all([
        pgStudentRepository.getStudentCount(),
        pgStudentRepository.getEnrollmentCount(),
      ]);
      return { students, enrollments };
    } catch (error) {
      logger.error('Error fetching student counts:', error);
      throw ApiError.internal('Failed to retrieve student counts');
    }
  },
};
