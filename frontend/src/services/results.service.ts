import { api } from './api';

export interface SubjectResultItem {
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
}

export interface StudentResultItem {
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
  subjects: SubjectResultItem[];
}

export interface StudentResultsResponse {
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
  results: StudentResultItem[];
}

export interface ExaminationLedgerResponse {
  examination: {
    id: number;
    examName: string;
    examType: string;
    examDate: string | null;
    status: string;
    semesterName: string;
    sessionName: string;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  students: Array<{
    studentId: number;
    hallTicketNumber: string;
    fullName: string;
    sectionId: number | null;
    sectionName: string | null;
    sgpa: number | null;
    cgpa: number | null;
    totalCredits: number | null;
    earnedCredits: number | null;
    overallResult: string | null;
    subjectResults: SubjectResultItem[];
  }>;
}

export const resultsService = {
  /**
   * Get complete result history for a student by Hall Ticket
   */
  async getStudentResults(hallTicket: string): Promise<StudentResultsResponse> {
    const res = await api.get<StudentResultsResponse>(`/students/${encodeURIComponent(hallTicket)}/results`);
    return (res as any).data || res;
  },

  /**
   * Get examination ledger results
   */
  async getExaminationResults(
    examinationId: number,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      sectionId?: number;
      resultStatus?: string;
    }
  ): Promise<ExaminationLedgerResponse> {
    const res = await api.get<ExaminationLedgerResponse>(`/examinations/${examinationId}/results`, { params });
    return (res as any).data || res;
  },
};
