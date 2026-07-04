import { studentRepository } from '../repositories/student.repository';
import { marksRepository } from '../repositories/marks.repository';
import { attendanceRepository } from '../repositories/attendance.repository';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { IStudent } from '../interfaces/db.interface';

/** Filter options for student list queries */
interface StudentFilter {
  section?: string;
  year?: number;
  search?: string;
  page?: number;
  limit?: number;
}

/** Paginated student list response */
interface PaginatedStudents {
  students: IStudent[];
  total: number;
  page: number;
  totalPages: number;
}

/** Full student profile with academic data and timeline */
interface FullStudentProfile {
  student: IStudent;
  marks: unknown[];
  attendanceSummary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  };
  timeline: Array<{
    date: string;
    type: string;
    title: string;
    description: string;
    status?: string;
  }>;
}

/**
 * Get a full student profile by hall ticket number including marks, attendance, and chronological timeline.
 * @param hallTicket - Hall ticket number
 * @returns Student document with marks, attendance summary, and timeline
 */
export const getStudentByHallTicket = async (
  hallTicket: string
): Promise<FullStudentProfile> => {
  try {
    const student = await studentRepository.findByHallTicket(hallTicket);

    if (!student) {
      throw ApiError.notFound(`Student with hall ticket ${hallTicket} not found.`);
    }

    // Fetch marks in SQLite
    const marks = await marksRepository.findByStudent(student.hallTicketNumber);

    // Fetch attendance history in SQLite
    const attendanceRecords = await attendanceRepository.getStudentHistory(student.hallTicketNumber);

    const total = attendanceRecords.length;
    const present = attendanceRecords.filter((a) => a.status === 'present').length;
    const absent = attendanceRecords.filter((a) => a.status === 'absent').length;
    const late = attendanceRecords.filter((a) => a.status === 'late').length;
    const percentage = total > 0 ? Math.round(((present + (late * 0.5)) / total) * 100) : 0;

    // Fetch Student Timeline
    const timeline = await studentRepository.getTimeline(student.hallTicketNumber);

    return {
      student,
      marks,
      attendanceSummary: { total, present, absent, late, percentage },
      timeline,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Get student by hall ticket error:', error);
    throw ApiError.internal('An error occurred while fetching student.');
  }
};

/**
 * Get a paginated list of students with optional filtering.
 * @param filter - Section, year, search term, page, limit
 * @returns Paginated students
 */
export const getStudentsByFilter = async (
  filter: StudentFilter
): Promise<PaginatedStudents> => {
  try {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const offset = (page - 1) * limit;

    const { rows: students, count: total } = await studentRepository.searchStudents({
      query: filter.search,
      section: filter.section,
      year: filter.year,
      limit,
      offset,
    });

    return {
      students,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Get students by filter error:', error);
    throw ApiError.internal('An error occurred while fetching students.');
  }
};

/**
 * Get a student's own full profile by their user ID.
 * @param userId - The authenticated user's ID
 * @returns Full student profile
 */
export const getStudentProfile = async (
  userId: string
): Promise<FullStudentProfile> => {
  try {
    const student = await studentRepository.findByUserId(Number(userId));

    if (!student) {
      throw ApiError.notFound('Student profile not found.');
    }

    return getStudentByHallTicket(student.hallTicketNumber);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Get student profile error:', error);
    throw ApiError.internal('An error occurred while fetching student profile.');
  }
};
