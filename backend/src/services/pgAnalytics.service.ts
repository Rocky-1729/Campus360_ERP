import {
  pgAnalyticsRepository,
  AnalyticsFilter,
  OverviewAnalyticsResult,
  DepartmentAnalyticsRow,
  ExaminationPerformanceResult,
} from '../repositories/pgAnalytics.repository';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export const pgAnalyticsService = {
  /**
   * Get college-wide overview analytics with optional academic filters
   */
  async getOverviewAnalytics(rawFilters: any): Promise<OverviewAnalyticsResult & { statusMessage: string }> {
    const filters: AnalyticsFilter = {};

    if (rawFilters.departmentId) {
      const id = parseInt(String(rawFilters.departmentId), 10);
      if (isNaN(id) || id <= 0) throw ApiError.badRequest('Invalid departmentId parameter.');
      filters.departmentId = id;
    }
    if (rawFilters.programId) {
      const id = parseInt(String(rawFilters.programId), 10);
      if (isNaN(id) || id <= 0) throw ApiError.badRequest('Invalid programId parameter.');
      filters.programId = id;
    }
    if (rawFilters.academicBatchId) {
      const id = parseInt(String(rawFilters.academicBatchId), 10);
      if (isNaN(id) || id <= 0) throw ApiError.badRequest('Invalid academicBatchId parameter.');
      filters.academicBatchId = id;
    }
    if (rawFilters.semesterId) {
      const id = parseInt(String(rawFilters.semesterId), 10);
      if (isNaN(id) || id <= 0) throw ApiError.badRequest('Invalid semesterId parameter.');
      filters.semesterId = id;
    }
    if (rawFilters.academicSessionId) {
      const id = parseInt(String(rawFilters.academicSessionId), 10);
      if (isNaN(id) || id <= 0) throw ApiError.badRequest('Invalid academicSessionId parameter.');
      filters.academicSessionId = id;
    }
    if (rawFilters.examinationId) {
      const id = parseInt(String(rawFilters.examinationId), 10);
      if (isNaN(id) || id <= 0) throw ApiError.badRequest('Invalid examinationId parameter.');
      filters.examinationId = id;
    }

    const data = await pgAnalyticsRepository.getOverviewAnalytics(filters);

    let statusMessage = 'Analytics calculated successfully from PostgreSQL data.';
    if (data.studentsWithResults === 0) {
      statusMessage = 'No examination results have been imported yet.';
    }

    return {
      ...data,
      statusMessage,
    };
  },

  /**
   * Get department analytics breakdown
   */
  async getDepartmentAnalytics(rawFilters: any): Promise<DepartmentAnalyticsRow[]> {
    let departmentId: number | undefined;
    if (rawFilters.departmentId) {
      departmentId = parseInt(String(rawFilters.departmentId), 10);
      if (isNaN(departmentId) || departmentId <= 0) {
        throw ApiError.badRequest('Invalid departmentId parameter.');
      }
    }

    return pgAnalyticsRepository.getDepartmentAnalytics({ departmentId });
  },

  /**
   * Get examination performance analytics by examination ID
   */
  async getExaminationPerformance(examinationIdStr: string): Promise<ExaminationPerformanceResult> {
    const examId = parseInt(examinationIdStr, 10);
    if (isNaN(examId) || examId <= 0) {
      throw ApiError.badRequest('Invalid examination ID parameter.');
    }

    const data = await pgAnalyticsRepository.getExaminationPerformance(examId);
    if (!data) {
      throw ApiError.notFound(`Examination with ID ${examId} was not found.`);
    }

    return data;
  },
};
