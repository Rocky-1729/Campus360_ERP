export interface AttendanceRecord {
  _id: string;
  hallTicketNumber: string;
  subjectId: string;
  subjectName?: string;
  facultyId: string;
  date: string;
  status: "Present" | "Absent" | "Late";
  semester: string;
  section: string;
}

export interface SubjectAttendance {
  subjectName: string;
  subjectId: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

export interface AttendanceSummary {
  overall: {
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  };
  subjectWise: SubjectAttendance[];
}

export interface MarkAttendanceInput {
  hallTicketNumber: string;
  subjectId: string;
  date: string;
  status: "Present" | "Absent" | "Late";
  semester: string;
  section: string;
}
