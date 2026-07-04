import { api } from './axios';
import type {
  ApiResponse,
  DashboardStats,
  Faculty,
  CreateFacultyInput,
  UpdateFacultyInput,
  Student,
  PaginatedResponse,
  AnalyticsData,
  Subject,
  Assignment,
} from '../types';

export const adminApi = {
  getDashboard: () =>
    api.get<unknown, ApiResponse<DashboardStats>>('/admin/dashboard'),

  // Faculty
  createFaculty: (data: CreateFacultyInput) =>
    api.post<unknown, ApiResponse<Faculty>>('/admin/faculty', data),

  updateFaculty: (id: string, data: UpdateFacultyInput) =>
    api.put<unknown, ApiResponse<Faculty>>(`/admin/faculty/${id}`, data),

  toggleFaculty: (id: string) =>
    api.patch<unknown, ApiResponse<Faculty>>(`/admin/faculty/${id}/toggle`),

  getAllFaculty: () =>
    api.get<unknown, ApiResponse<Faculty[]>>('/admin/faculty'),

  // Students
  uploadStudents: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<unknown, ApiResponse<{ total: number; successful: number; updated: number; failed: { row: number; error: string }[] }>>(
      '/admin/students/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  getStudents: (params?: Record<string, string>) =>
    api.get<unknown, ApiResponse<PaginatedResponse<Student>>>('/admin/students', { params }),

  searchStudent: (hallTicket: string) =>
    api.get<unknown, ApiResponse<Student>>(`/admin/students/search/${hallTicket}`),

  // Marks
  uploadMarks: (file: File, academicYear: string, semester?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('academicYear', academicYear);
    if (semester) {
      formData.append('semester', semester);
    }
    return api.post<unknown, ApiResponse<{ total: number; successful: number; failed: { row: number; error: string }[] }>>(
      '/admin/marks/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  // Subjects
  createSubject: (data: Omit<Subject, '_id'>) =>
    api.post<unknown, ApiResponse<Subject>>('/admin/subjects', data),

  getSubjects: (params?: Record<string, string>) =>
    api.get<unknown, ApiResponse<Subject[]>>('/admin/subjects', { params }),

  updateSubject: (id: string, data: Partial<Subject>) =>
    api.put<unknown, ApiResponse<Subject>>(`/admin/subjects/${id}`, data),

  deleteSubject: (id: string) =>
    api.delete<unknown, ApiResponse<null>>(`/admin/subjects/${id}`),

  // Assignments
  createAssignment: (data: Omit<Assignment, '_id' | 'facultyName' | 'subjectCode' | 'subjectName'>) =>
    api.post<unknown, ApiResponse<Assignment>>('/admin/assignments', data),

  getAssignments: (params?: Record<string, string>) =>
    api.get<unknown, ApiResponse<Assignment[]>>('/admin/assignments', { params }),

  deleteAssignment: (id: string) =>
    api.delete<unknown, ApiResponse<null>>(`/admin/assignments/${id}`),

  // Analytics
  getAnalytics: (params?: Record<string, string>) =>
    api.get<unknown, ApiResponse<AnalyticsData>>('/admin/analytics', { params }),

  // System Backup & Logs
  getUploadHistory: () =>
    api.get<unknown, ApiResponse<any[]>>('/admin/upload-history'),

  getAuditLogs: () =>
    api.get<unknown, ApiResponse<any[]>>('/admin/audit-logs'),

  restoreDb: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<unknown, ApiResponse<null>>(
      '/admin/restore',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
};
