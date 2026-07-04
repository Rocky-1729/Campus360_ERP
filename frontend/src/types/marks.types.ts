export interface Mark {
  _id: string;
  hallTicketNumber: string;
  subjectCode: string;
  subjectName: string;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  grade: string;
  credits: number;
  sgpa: number;
  cgpa: number;
  result: 'Pass' | 'Fail' | 'Detained' | 'Absent';
  semester: string;
  academicYear: string;
}

export interface SemesterSummary {
  semester: string;
  sgpa: number;
  cgpa: number;
  totalCredits: number;
  earnedCredits: number;
}
