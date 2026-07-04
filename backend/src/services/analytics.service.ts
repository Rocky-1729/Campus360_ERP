import { studentRepository } from '../repositories/student.repository';
import { facultyRepository } from '../repositories/faculty.repository';
import { subjectRepository } from '../repositories/subject.repository';
import { marksRepository } from '../repositories/marks.repository';
import { attendanceRepository } from '../repositories/attendance.repository';
import { certificateRepository } from '../repositories/certificate.repository';
import { achievementRepository } from '../repositories/achievement.repository';
import { cacheRepository } from '../repositories/cache.repository';
import * as db from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

/** Analytics filter for faculty-scoped queries */
interface FacultyAnalyticsFilter {
  section?: string;
  semester?: string;
  subjectCode?: string;
  academicYear?: string;
}

/** Department-level analytics response */
interface DepartmentAnalytics {
  totalStudents: number;
  totalFaculty: number;
  totalSubjects: number;
  totalCertificates: number;
  totalAchievements: number;
  pendingCertificates: number;
  pendingAchievements: number;
  cgpaDistribution: Record<string, number>;
  attendanceDistribution: Record<string, number>;
}

/** Faculty-scoped analytics response */
interface FacultyAnalyticsResponse {
  totalAssignedStudents: number;
  assignments: number;
  cgpaDistribution: Record<string, number>;
  attendanceDistribution: Record<string, number>;
  backlogAnalysis: Record<string, number>;
  topPerformers: Array<{ hallTicketNumber: string; name: string; cgpa: number }>;
  atRiskStudents: Array<{ hallTicketNumber: string; name: string; cgpa: number; attendancePercentage: number }>;
}

/**
 * Get department-wide analytics for admin dashboard.
 * Implements dashboard cache lookup.
 * @returns Aggregate counts and distributions
 */
export const getDepartmentAnalytics = async (bypassCache: boolean = false): Promise<DepartmentAnalytics> => {
  try {
    if (!bypassCache) {
      const cached = await cacheRepository.getCache<DepartmentAnalytics>(null);
      if (cached) {
        logger.info('Returning cached admin department analytics');
        return cached;
      }
    }

    logger.info('Computing department-wide analytics...');

    // Total counts from SQLite tables
    const studentRes = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM students WHERE isActive = 1');
    const facultyRes = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM faculty WHERE isActive = 1');
    const subjectRes = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM subjects WHERE isActive = 1');
    const certTotalRes = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM certificates');
    const achTotalRes = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM achievements');
    const certPendRes = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM certificates WHERE status = 'pending'");
    const achPendRes = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM achievements WHERE status = 'pending'");

    const totalStudents = studentRes?.count || 0;
    const totalFaculty = facultyRes?.count || 0;
    const totalSubjects = subjectRes?.count || 0;
    const totalCertificates = certTotalRes?.count || 0;
    const totalAchievements = achTotalRes?.count || 0;
    const pendingCertificates = certPendRes?.count || 0;
    const pendingAchievements = achPendRes?.count || 0;

    // Fetch marks analytics
    const marksStats = await marksRepository.getAnalytics({});

    // Fetch attendance distribution
    const studentsList = await db.all<{ hallTicketNumber: string }>('SELECT hallTicketNumber FROM students WHERE isActive = 1');
    const attendanceDistribution = {
      'Above 90%': 0,
      '80-89%': 0,
      '75-79%': 0,
      'Below 75%': 0,
    };

    for (const s of studentsList) {
      const summaryList = await attendanceRepository.getSubjectSummary(s.hallTicketNumber);
      if (summaryList.length === 0) continue;
      const totalPct = Math.round(
        summaryList.reduce((acc, curr) => acc + curr.percentage, 0) / summaryList.length
      );
      if (totalPct >= 90) attendanceDistribution['Above 90%']++;
      else if (totalPct >= 80) attendanceDistribution['80-89%']++;
      else if (totalPct >= 75) attendanceDistribution['75-79%']++;
      else attendanceDistribution['Below 75%']++;
    }

    const result: DepartmentAnalytics = {
      totalStudents,
      totalFaculty,
      totalSubjects,
      totalCertificates,
      totalAchievements,
      pendingCertificates,
      pendingAchievements,
      cgpaDistribution: marksStats.cgpaDistribution,
      attendanceDistribution,
    };

    // Save to cache
    await cacheRepository.setCache(null, result);

    return result;
  } catch (error) {
    logger.error('Get department analytics error:', error);
    throw ApiError.internal('An error occurred while fetching analytics.');
  }
};

/**
 * Get analytics scoped to a faculty member's assigned students.
 * @param facultyId - Faculty document ID
 * @param filters - Optional filters
 * @returns Faculty-scoped analytics
 */
export const getFacultyAnalytics = async (
  facultyId: string,
  filters: FacultyAnalyticsFilter,
  bypassCache: boolean = false
): Promise<FacultyAnalyticsResponse> => {
  try {
    const cacheKey = Number(facultyId);
    if (!bypassCache) {
      const cached = await cacheRepository.getCache<FacultyAnalyticsResponse>(cacheKey);
      if (cached) {
        logger.info(`Returning cached analytics for faculty ID: ${facultyId}`);
        return cached;
      }
    }

    logger.info(`Computing analytics for faculty ID: ${facultyId}...`);

    // Fetch assignments
    const assignments = await facultyRepository.getAssignments({ facultyId: Number(facultyId) });

    // Scoped section list
    const sections = [...new Set(assignments.map((a) => a.section))];
    let sectionFilter = sections;
    if (filters.section) {
      sectionFilter = [filters.section];
    }

    const students = await db.all<any>(
      `SELECT hallTicketNumber, name FROM students WHERE section IN (${sections.map(() => '?').join(',')}) AND isActive = 1`,
      sectionFilter
    );

    const hallTickets = students.map((s) => s.hallTicketNumber);
    const marksStats = await marksRepository.getAnalytics({
      section: filters.section,
      semester: filters.semester,
      subjectCode: filters.subjectCode,
      academicYear: filters.academicYear,
    });

    // Attendance distribution for faculty class
    const attendanceDistribution = {
      'Above 90%': 0,
      '80-89%': 0,
      '75-79%': 0,
      'Below 75%': 0,
    };

    const atRiskStudents: any[] = [];

    for (const s of students) {
      const summaryList = await attendanceRepository.getSubjectSummary(s.hallTicketNumber);
      let totalPct = 100;
      if (summaryList.length > 0) {
        totalPct = Math.round(
          summaryList.reduce((acc, curr) => acc + curr.percentage, 0) / summaryList.length
        );
      }

      if (totalPct >= 90) attendanceDistribution['Above 90%']++;
      else if (totalPct >= 80) attendanceDistribution['80-89%']++;
      else if (totalPct >= 75) attendanceDistribution['75-79%']++;
      else attendanceDistribution['Below 75%']++;

      // Check if student is at risk in faculty sections
      const studentMarks = marksStats.atRiskStudents.find((am: any) => am.hallTicketNumber === s.hallTicketNumber);
      if (totalPct < 75 || studentMarks) {
        atRiskStudents.push({
          hallTicketNumber: s.hallTicketNumber,
          name: s.name,
          cgpa: studentMarks?.cgpa || 0,
          attendancePercentage: totalPct,
          backlogs: studentMarks?.backlogs || 0,
        });
      }
    }

    const result: FacultyAnalyticsResponse = {
      totalAssignedStudents: students.length,
      assignments: assignments.length,
      cgpaDistribution: marksStats.cgpaDistribution,
      attendanceDistribution,
      backlogAnalysis: marksStats.backlogAnalysis,
      topPerformers: marksStats.topPerformers,
      atRiskStudents,
    };

    // Save to cache
    await cacheRepository.setCache(cacheKey, result);

    return result;
  } catch (error) {
    logger.error('Get faculty analytics error:', error);
    throw ApiError.internal('An error occurred while fetching faculty analytics.');
  }
};

/**
 * Flush all caches. Typically triggered when Marks or Student rosters are imported.
 */
export const flushAnalyticsCache = async (): Promise<void> => {
  await cacheRepository.clearAll();
  logger.info('Flush database analytics cache completed.');
};
