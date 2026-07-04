import { api } from './axios';
import type {
  ApiResponse,
  StudentDashboardStats,
  StudentProfile,
  Mark,
  AttendanceSummary,
  AttendanceRecord,
  Certificate,
  Achievement,
} from '../types';

export const studentApi = {
  getDashboard: () =>
    api.get<unknown, ApiResponse<StudentDashboardStats>>('/student/dashboard'),

  getProfile: () =>
    api.get<unknown, ApiResponse<StudentProfile>>('/student/profile'),

  getMarks: (semester?: string) =>
    api.get<unknown, ApiResponse<Mark[]>>('/student/marks', {
      params: semester ? { semester } : undefined,
    }),

  getAttendance: (params?: Record<string, string>) =>
    api.get<unknown, ApiResponse<{ summary: AttendanceSummary; records: AttendanceRecord[] }>>(
      '/student/attendance',
      { params },
    ),

  // Certificates
  uploadCertificate: (data: FormData) =>
    api.post<unknown, ApiResponse<Certificate>>('/student/certificates', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getCertificates: () =>
    api.get<unknown, ApiResponse<Certificate[]>>('/student/certificates'),

  // Achievements
  uploadAchievement: (data: FormData) =>
    api.post<unknown, ApiResponse<Achievement>>('/student/achievements', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getAchievements: () =>
    api.get<unknown, ApiResponse<Achievement[]>>('/student/achievements'),
};
