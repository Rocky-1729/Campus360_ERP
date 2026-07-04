import { api } from './axios';
import type {
  ApiResponse,
  FacultyDashboardStats,
  Student,
  StudentProfile,
  PaginatedResponse,
  MarkAttendanceInput,
  AttendanceRecord,
  Certificate,
  Achievement,
  AnalyticsData,
} from '../types';

export const facultyApi = {
  getDashboard: () =>
    api.get<unknown, ApiResponse<FacultyDashboardStats>>('/faculty/dashboard'),

  // Students
  getStudents: (params?: Record<string, string>) =>
    api.get<unknown, ApiResponse<PaginatedResponse<Student>>>('/faculty/students', { params }),

  searchStudent: (hallTicket: string) =>
    api.get<unknown, ApiResponse<Student>>(`/faculty/students/search/${hallTicket}`),

  getStudentProfile: (hallTicket: string) =>
    api.get<unknown, ApiResponse<StudentProfile>>(`/faculty/students/${hallTicket}/profile`),

  // Attendance
  markAttendance: (data: MarkAttendanceInput[]) =>
    api.post<unknown, ApiResponse<{ marked: number }>>('/faculty/attendance', data),

  updateAttendance: (id: string, data: Partial<AttendanceRecord>) =>
    api.put<unknown, ApiResponse<AttendanceRecord>>(`/faculty/attendance/${id}`, data),

  getAttendanceForMarking: (params: Record<string, string>) =>
    api.get<unknown, ApiResponse<{ students: Student[]; attendance: AttendanceRecord[] }>>(
      '/faculty/attendance/marking',
      { params },
    ),

  // Certificates
  getPendingCertificates: () =>
    api.get<unknown, ApiResponse<Certificate[]>>('/faculty/certificates/pending'),

  reviewCertificate: (id: string, data: { status: string; remarks: string }) =>
    api.patch<unknown, ApiResponse<Certificate>>(`/faculty/certificates/${id}`, data),

  // Achievements
  getPendingAchievements: () =>
    api.get<unknown, ApiResponse<Achievement[]>>('/faculty/achievements/pending'),

  reviewAchievement: (id: string, data: { status: string; remarks: string }) =>
    api.patch<unknown, ApiResponse<Achievement>>(`/faculty/achievements/${id}`, data),

  // Analytics
  getAnalytics: (params?: Record<string, string>) =>
    api.get<unknown, ApiResponse<AnalyticsData>>('/faculty/analytics', { params }),
};
