import { api } from './api';

export interface OverviewAnalyticsData {
  totalStudents: number;
  studentsWithResults: number;
  totalExaminations: number;
  totalSubjects: number;
  passedStudents: number;
  failedStudents: number;
  passPercentage: number | null;
  averageSGPA: number | null;
  averageCGPA: number | null;
  cgpaDistribution: Record<string, number>;
  backlogDistribution: {
    zeroBacklogs: number;
    oneBacklog: number;
    twoBacklogs: number;
    threeOrMoreBacklogs: number;
    totalBacklogStudents: number;
  };
  statusMessage: string;
}

export interface DepartmentAnalyticsData {
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  totalStudents: number;
  studentsWithResults: number;
  passedStudents: number;
  failedStudents: number;
  passPercentage: number | null;
  averageSGPA: number | null;
  averageCGPA: number | null;
}

export interface ExaminationPerformanceData {
  examination: {
    id: number;
    examName: string;
    examType: string;
    examDate: string | null;
    status: string;
    semesterName: string;
    sessionName: string;
  };
  totalAppeared: number;
  passedCount: number;
  failedCount: number;
  passPercentage: number | null;
  averageSGPA: number | null;
  gradeDistribution: Record<string, number>;
  subjects: Array<{
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    appeared: number;
    passed: number;
    failed: number;
    absent: number;
    passPercentage: number | null;
    averageInternalMarks: number | null;
    averageExternalMarks: number | null;
    averageTotalMarks: number | null;
    gradeDistribution: Record<string, number>;
  }>;
}

export const analyticsService = {
  /**
   * Get college-wide overview analytics
   */
  async getOverview(filters?: {
    departmentId?: number | string;
    programId?: number | string;
    academicBatchId?: number | string;
    semesterId?: number | string;
    academicSessionId?: number | string;
    examinationId?: number | string;
  }): Promise<OverviewAnalyticsData> {
    const res = await api.get<OverviewAnalyticsData>('/analytics/overview', { params: filters });
    return (res as any).data || res;
  },

  /**
   * Get department analytics breakdown
   */
  async getDepartments(filters?: { departmentId?: number | string }): Promise<DepartmentAnalyticsData[]> {
    const res = await api.get<DepartmentAnalyticsData[]>('/analytics/departments', { params: filters });
    return (res as any).data || res;
  },

  /**
   * Get examination performance analytics
   */
  async getExamPerformance(examinationId: number | string): Promise<ExaminationPerformanceData> {
    const res = await api.get<ExaminationPerformanceData>(`/analytics/examinations/${examinationId}/performance`);
    return (res as any).data || res;
  },
};
