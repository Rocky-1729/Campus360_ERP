export interface DashboardStats {
  totalStudents: number;
  totalFaculty: number;
  totalSubjects: number;
  totalCertificates: number;
  totalAchievements: number;
  pendingCertificates: number;
  pendingAchievements: number;
  notificationsSent: number;
}

export interface CgpaDistribution {
  range: string;
  count: number;
}

export interface AttendanceDistribution {
  range: string;
  count: number;
}

export interface BacklogAnalysis {
  backlogs: string;
  count: number;
}

export interface SubjectPerformance {
  subjectName: string;
  subjectCode?: string;
  highest: number;
  lowest: number;
  average: number;
  passCount: number;
  failCount: number;
}

export interface AnalyticsData {
  summary: {
    totalStudents: number;
    avgCgpa: number;
    avgAttendance: number;
    passPercentage: number;
    failPercentage: number;
  };
  cgpaDistribution: CgpaDistribution[];
  attendanceDistribution: AttendanceDistribution[];
  backlogAnalysis: BacklogAnalysis[];
  subjectPerformance: SubjectPerformance[];
  topPerformers: {
    hallTicketNumber: string;
    name: string;
    cgpa: number;
    sgpa: number;
  }[];
  atRiskStudents: {
    hallTicketNumber: string;
    name: string;
    cgpa: number;
    attendance: number;
    reason: string;
  }[];
}

export interface FacultyDashboardStats {
  totalAssignedStudents: number;
  subjectsAssigned: number;
  todaysAttendance: number;
  pendingAttendance: number;
  avgAttendance: number;
  avgCgpa: number;
  studentsWithBacklogs: number;
}

export interface StudentDashboardStats {
  currentSgpa: number;
  currentCgpa: number;
  overallAttendance: number;
  totalCertificates: number;
  totalAchievements: number;
  pendingCertificates: number;
  pendingAchievements: number;
}

export interface Subject {
  _id: string;
  code: string;
  name: string;
  credits: number;
  semester: string;
  academicYear: string;
  department?: string;
}

export interface Assignment {
  _id: string;
  facultyId: string;
  facultyName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  semester: string;
  academicYear: string;
}
