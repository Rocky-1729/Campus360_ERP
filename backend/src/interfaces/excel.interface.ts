export interface StudentExcelRow {
  hallTicketNumber: string;
  name: string;
  fatherName?: string;
  motherName?: string;
  email?: string;
  mobile?: string;
  dateOfBirth?: string;
  gender?: 'Male' | 'Female' | 'Other';
  aadhaarNumber?: string;
  abcId?: string;
  department?: string;
  year?: number;
  section?: string;
}

export interface MarksExcelRow {
  hallTicketNumber: string;
  subjectCode: string;
  subjectName: string;
  internalMarks?: number;
  externalMarks?: number;
  totalMarks?: number;
  grade?: string;
  credits?: number;
  sgpa?: number;
  cgpa?: number;
  result?: string;
  semester: string;
}

export interface InvalidRow {
  row: number;
  errors: string[];
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row?: number; hallTicketNumber?: string; message: string }>;
}
