import { marksRepository } from '../repositories/marks.repository';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { SEMESTERS } from '../utils/constants';
import { IMarks } from '../interfaces/db.interface';

/** SGPA/CGPA summary per semester */
interface SemesterSummary {
  semester: string;
  sgpa: number;
  cgpa: number;
  totalSubjects: number;
  passCount: number;
  failCount: number;
  totalCredits: number;
}

/**
 * Get marks for a student by hall ticket, optionally filtered by semester.
 */
export const getMarksByHallTicket = async (
  hallTicket: string,
  semester?: string
): Promise<IMarks[]> => {
  try {
    return marksRepository.findByStudent(hallTicket, semester);
  } catch (error) {
    logger.error('Get marks by hall ticket error:', error);
    throw ApiError.internal('An error occurred while fetching marks.');
  }
};

/**
 * Get SGPA/CGPA summary per semester for a student.
 */
export const getMarksSummary = async (
  hallTicket: string
): Promise<SemesterSummary[]> => {
  try {
    const allMarks = await marksRepository.findByStudent(hallTicket);

    if (allMarks.length === 0) {
      return [];
    }

    // Group marks by semester
    const grouped: Record<string, IMarks[]> = {};
    for (const mark of allMarks) {
      if (!grouped[mark.semester]) {
        grouped[mark.semester] = [];
      }
      grouped[mark.semester].push(mark);
    }

    const summaries: SemesterSummary[] = [];
    let cumulativeCredits = 0;
    let cumulativeGradePoints = 0;

    // Process semesters in order
    for (const sem of SEMESTERS) {
      const semMarks = grouped[sem];
      if (!semMarks || semMarks.length === 0) continue;

      const totalSubjects = semMarks.length;
      const passCount = semMarks.filter((m) => m.result === 'Pass').length;
      const failCount = semMarks.filter((m) => m.result === 'Fail').length;
      const totalCredits = semMarks.reduce((acc, m) => acc + (m.credits || 0), 0);

      // Use the SGPA from data if available
      const latestSgpa = semMarks[0]?.sgpa || 0;
      const latestCgpa = semMarks[0]?.cgpa || 0;

      if (latestSgpa > 0 && totalCredits > 0) {
        cumulativeGradePoints += latestSgpa * totalCredits;
        cumulativeCredits += totalCredits;
      }

      summaries.push({
        semester: sem,
        sgpa: latestSgpa,
        cgpa: latestCgpa || (cumulativeCredits > 0
          ? Math.round((cumulativeGradePoints / cumulativeCredits) * 100) / 100
          : 0),
        totalSubjects,
        passCount,
        failCount,
        totalCredits,
      });
    }

    return summaries;
  } catch (error) {
    logger.error('Get marks summary error:', error);
    throw ApiError.internal('An error occurred while fetching marks summary.');
  }
};
