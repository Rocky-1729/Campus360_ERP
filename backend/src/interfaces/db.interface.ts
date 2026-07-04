export interface IUser {
  id?: number;
  username: string;
  email?: string;
  password?: string;
  role: 'admin' | 'faculty' | 'student';
  isActive?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IFaculty {
  id?: number;
  userId: number;
  facultyId: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  qualification?: string;
  isActive?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IStudent {
  id?: number;
  userId?: number;
  hallTicketNumber: string;
  name: string;
  fatherName?: string;
  motherName?: string;
  email?: string;
  mobile?: string;
  dateOfBirth?: string;
  gender?: string;
  aadhaarNumber?: string;
  abcId?: string;
  department?: string;
  year?: number;
  section?: string;
  isActive?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ISemester {
  id?: number;
  code: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ISubject {
  id?: number;
  subjectCode: string;
  subjectName: string;
  department?: string;
  semester: string;
  credits?: number;
  isActive?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IFacultyAssignment {
  id?: number;
  facultyId: number;
  subjectId: number;
  section: string;
  semester: string;
  createdAt?: string;
  updatedAt?: string;

  // Joined fields optionally returned
  facultyName?: string;
  facultyCode?: string;
  subjectCode?: string;
  subjectName?: string;
}

export interface IAttendance {
  id?: number;
  hallTicketNumber: string;
  subjectId: number;
  status: 'present' | 'absent' | 'late';
  date: string;
  semester: string;
  section: string;
  createdAt?: string;
  updatedAt?: string;

  // Joined fields
  studentName?: string;
  subjectCode?: string;
  subjectName?: string;
}

export interface IAttendanceLock {
  id?: number;
  subjectId: number;
  date: string;
  section: string;
  locked: number;
  lockedBy: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IMarks {
  id?: number;
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
  academicYear: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICertificate {
  id?: number;
  hallTicketNumber: string;
  type: string;
  title: string;
  issuingOrganization: string;
  issueDate: string;
  certificateUrl: string;
  status?: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IAchievement {
  id?: number;
  hallTicketNumber: string;
  category: string;
  title: string;
  description?: string;
  date: string;
  documentUrl?: string;
  status?: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface INotification {
  id?: number;
  senderId: number;
  senderName: string;
  type: string;
  title: string;
  message: string;
  targetRole: 'admin' | 'faculty' | 'student' | 'all';
  targetSection?: string;
  createdAt?: string;
  updatedAt?: string;
  
  // Custom joined fields
  readBy?: number[];
  isRead?: boolean | number;
}

export interface INotificationRead {
  id?: number;
  notificationId: number;
  userId: number;
  isRead?: number;
  readAt?: string;
}

export interface IUploadHistory {
  id?: number;
  uploadedBy: number;
  fileName: string;
  semester?: string;
  year?: string;
  recordsImported?: number;
  status?: string;
  uploadedAt?: string;
  
  // Joined fields
  uploadedByName?: string;
}

export interface IAuditLog {
  id?: number;
  userId: number;
  username: string;
  role: string;
  action: string;
  tableName: string;
  recordId?: number;
  ipAddress?: string;
  createdAt?: string;
}

export interface IAnalyticsCache {
  id?: number;
  facultyId?: number;
  jsonData: string;
  updatedAt?: string;
}

export interface IErrorLog {
  id?: number;
  api: string;
  error: string;
  stack?: string;
  createdAt?: string;
}
