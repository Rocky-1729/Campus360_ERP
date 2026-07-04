/** All valid semester values */
export const SEMESTERS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'] as const;

/** User role constants */
export const USER_ROLES = {
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student',
} as const;

/** Allowed certificate types for student uploads */
export const CERTIFICATE_TYPES = [
  'Internship',
  'Workshop',
  'NPTEL',
  'Coursera',
  'Technical Course',
  'Hackathon',
] as const;

/** Allowed achievement category values */
export const ACHIEVEMENT_CATEGORIES = [
  'Sports',
  'Coding Competition',
  'Paper Presentation',
  'Hackathon',
  'Research',
  'Cultural',
] as const;

/** Allowed notification type values */
export const NOTIFICATION_TYPES = [
  'Exam',
  'Placement Drive',
  'Workshop',
  'Holiday',
  'Circular',
] as const;

/** Generic status constants for approvals */
export const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

/** Attendance status values */
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
} as const;

/** Type helpers derived from the const arrays/objects above */
export type Semester = typeof SEMESTERS[number];
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type CertificateType = typeof CERTIFICATE_TYPES[number];
export type AchievementCategory = typeof ACHIEVEMENT_CATEGORIES[number];
export type NotificationType = typeof NOTIFICATION_TYPES[number];
export type StatusType = typeof STATUS[keyof typeof STATUS];
export type AttendanceStatusType = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];
