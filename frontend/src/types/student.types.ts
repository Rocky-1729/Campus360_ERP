import type { Mark } from './marks.types';
import type { AttendanceSummary } from './attendance.types';
import type { Certificate } from './certificate.types';
import type { Achievement } from './achievement.types';

export interface Student {
  _id: string;
  userId: string;
  hallTicketNumber: string;
  name: string;
  fatherName: string;
  motherName: string;
  email: string;
  mobile: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  aadhaarNumber: string;
  abcId: string;
  department: string;
  year: number;
  section: string;
}

export interface StudentProfile extends Student {
  marks: Mark[];
  attendanceSummary: AttendanceSummary;
  certificates: Certificate[];
  achievements: Achievement[];
}
