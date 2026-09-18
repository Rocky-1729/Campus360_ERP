import { pgResultRepository, StudentAcademicInfo } from '../repositories/pgResult.repository';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export interface FormattedStudentResultResponse {
  student: {
    id: number;
    hallTicketNumber: string;
    fullName: string;
    gender: string | null;
    dateOfBirth: string | null;
    email: string | null;
    phoneNumber: string | null;
    enrollmentStatus: string | null;
    batchName: string | null;
    startYear: number | null;
    expectedCompletionYear: number | null;
    programCode: string | null;
    programName: string | null;
    degree: string | null;
    departmentCode: string | null;
    departmentName: string | null;
    sectionName: string | null;
  };
  results: Array<{
    examination: {
      id: number;
      examName: string;
      examType: string;
      examDate: string | null;
    };
    semester: {
      id: number;
      semesterNumber: number;
      yearNumber: number;
      semesterName: string;
    };
    academicSession: {
      id: number;
      sessionName: string;
    };
    summary: {
      sgpa: number | null;
      cgpa: number | null;
      totalCredits: number | null;
      earnedCredits: number | null;
      overallResult: string | null;
    };
    subjects: Array<{
      subjectId: number;
      subjectCode: string;
      subjectName: string;
      internalMarks: number | null;
      externalMarks: number | null;
      totalMarks: number | null;
      grade: string | null;
      resultStatus: string;
      attemptNumber: number;
      credits: number | null;
      maximumInternalMarks: number | null;
      maximumExternalMarks: number | null;
      maximumTotalMarks: number | null;
    }>;
  }>;
}

export const resultManagementService = {
  /**
   * Fetch complete academic result history for a student by Hall Ticket
   */
  async getStudentResultHistory(hallTicket: string): Promise<FormattedStudentResultResponse> {
    const student = await pgResultRepository.findStudentByHallTicket(hallTicket);
    if (!student) {
      throw ApiError.notFound(`Student with hall ticket "${hallTicket}" was not found in the database.`);
    }

    const [subjects, summaries] = await Promise.all([
      pgResultRepository.getStudentSubjectResults(student.id),
      pgResultRepository.getStudentSemesterSummaries(student.id),
    ]);

    // Map summaries by examinationId
    const summaryByExamId = new Map<number, any>();
    summaries.forEach((s) => {
      summaryByExamId.set(Number(s.examinationId), s);
    });

    // Group subjects by examination
    const examMap = new Map<number, any>();

    subjects.forEach((sub) => {
      const examId = Number(sub.examinationId);
      if (!examMap.has(examId)) {
        const sum = summaryByExamId.get(examId);
        examMap.set(examId, {
          examination: {
            id: examId,
            examName: sub.examName,
            examType: sub.examType,
            examDate: sub.examDate,
          },
          semester: {
            id: Number(sub.semesterId),
            semesterNumber: sub.semesterNumber,
            yearNumber: sub.yearNumber,
            semesterName: sub.semesterName,
          },
          academicSession: {
            id: Number(sub.academicSessionId),
            sessionName: sub.sessionName,
          },
          summary: {
            sgpa: sum?.sgpa != null ? Number(sum.sgpa) : null,
            cgpa: sum?.cgpa != null ? Number(sum.cgpa) : null,
            totalCredits: sum?.totalCredits != null ? Number(sum.totalCredits) : null,
            earnedCredits: sum?.earnedCredits != null ? Number(sum.earnedCredits) : null,
            overallResult: sum?.overallResult || null,
          },
          subjects: [],
        });
      }

      examMap.get(examId).subjects.push({
        subjectId: Number(sub.subjectId),
        subjectCode: sub.subjectCode,
        subjectName: sub.subjectName,
        internalMarks: sub.internalMarks,
        externalMarks: sub.externalMarks,
        totalMarks: sub.totalMarks,
        grade: sub.grade,
        resultStatus: sub.resultStatus,
        attemptNumber: sub.attemptNumber,
        credits: sub.credits,
        maximumInternalMarks: sub.maximumInternalMarks,
        maximumExternalMarks: sub.maximumExternalMarks,
        maximumTotalMarks: sub.maximumTotalMarks,
      });
    });

    return {
      student: {
        id: Number(student.id),
        hallTicketNumber: student.hallTicketNumber,
        fullName: student.fullName,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        email: student.email,
        phoneNumber: student.phoneNumber,
        enrollmentStatus: student.enrollmentStatus,
        batchName: student.batchName,
        startYear: student.startYear,
        expectedCompletionYear: student.expectedCompletionYear,
        programCode: student.programCode,
        programName: student.programName,
        degree: student.degree,
        departmentCode: student.departmentCode,
        departmentName: student.departmentName,
        sectionName: student.sectionName,
      },
      results: Array.from(examMap.values()),
    };
  },

  /**
   * Fetch paginated examination results ledger
   */
  async getExaminationResults(
    examinationId: number,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      sectionId?: number;
      resultStatus?: string;
    }
  ): Promise<any> {
    const exam = await pgResultRepository.findExaminationById(examinationId);
    if (!exam) {
      throw ApiError.notFound(`Examination with ID ${examinationId} was not found in the database.`);
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));

    const { students, totalCount } = await pgResultRepository.getExaminationStudentLedger(
      examinationId,
      options
    );

    const totalPages = Math.ceil(totalCount / limit);

    return {
      examination: {
        id: Number(exam.id),
        examName: exam.examName,
        examType: exam.examType,
        examDate: exam.examDate,
        status: exam.status,
        semesterName: exam.semesterName,
        sessionName: exam.sessionName,
      },
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages,
      },
      students,
    };
  },
};
