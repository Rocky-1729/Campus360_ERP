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

// ====================================================
// PostgreSQL Academic Structure Interfaces
// ====================================================

export interface IDepartment {
  id: string | number;
  department_code: string;
  department_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface IProgram {
  id: string | number;
  department_id: string | number;
  program_code: string;
  program_name: string;
  degree: string;
  duration_years: number;
  created_at?: string;
  updated_at?: string;
  department_name?: string;
  department_code?: string;
}

export interface IAcademicBatch {
  id: string | number;
  program_id: string | number;
  batch_name: string;
  start_year: number;
  expected_completion_year: number;
  created_at?: string;
  updated_at?: string;
  program_name?: string;
  program_code?: string;
}

export interface ISection {
  id: string | number;
  academic_batch_id: string | number;
  section_name: string;
  created_at?: string;
  updated_at?: string;
  batch_name?: string;
}

export interface IAcademicSession {
  id: string | number;
  session_name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface IPgSemester {
  id: string | number;
  semester_number: number;
  year_number: number;
  semester_name: string;
  created_at?: string;
}

// ====================================================
// PostgreSQL Student & Enrollment Interfaces
// ====================================================

export interface IPgStudent {
  id: string | number;
  hall_ticket_number: string;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  email?: string | null;
  phone_number?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IPgStudentAcademicEnrollment {
  id: string | number;
  student_id: string | number;
  academic_batch_id: string | number;
  section_id?: string | number | null;
  enrollment_status: string;
  joined_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IStudentListItem {
  id: string;
  hallTicketNumber: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  gender: string | null;
  dateOfBirth?: string | null;
  departmentId?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  programId?: string | null;
  programCode?: string | null;
  programName?: string | null;
  batchId?: string | null;
  batchName?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  enrollmentStatus?: string | null;
  joinedDate?: string | null;
}

export interface IStudentProfileDetails extends IStudentListItem {
  createdAt?: string;
  updatedAt?: string;
  batchStartYear?: number | null;
  batchExpectedCompletionYear?: number | null;
  degree?: string | null;
  durationYears?: number | null;
}

export interface IStudentListFilters {
  search?: string;
  departmentId?: number | string;
  programId?: number | string;
  batchId?: number | string;
  sectionId?: number | string;
  status?: string;
  page?: number;
  limit?: number;
}

// ====================================================
// PostgreSQL Subjects & Examination Interfaces
// ====================================================

export interface IPgSubject {
  id: string | number;
  subject_code: string;
  subject_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface ISubjectListItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IPgCurriculumSubject {
  id: string | number;
  academic_batch_id: string | number;
  semester_id: string | number;
  subject_id: string | number;
  maximum_internal_marks?: number;
  maximum_external_marks?: number;
  maximum_total_marks?: number;
  credits?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ICurriculumSubjectView {
  id: string;
  batchId: string;
  batchName: string;
  programId: string;
  programCode: string;
  programName: string;
  semesterId: string;
  semesterNumber: number;
  semesterName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  maximumInternalMarks: number;
  maximumExternalMarks: number;
  maximumTotalMarks: number;
  credits: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IPgExamination {
  id: string | number;
  academic_session_id: string | number;
  semester_id: string | number;
  exam_type: 'REGULAR' | 'SUPPLEMENTARY';
  exam_name: string;
  exam_date?: string | null;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  created_at?: string;
  updated_at?: string;
}

export interface IExaminationView {
  id: string;
  academicSessionId: string;
  sessionName: string;
  semesterId: string;
  semesterNumber: number;
  semesterName: string;
  examType: 'REGULAR' | 'SUPPLEMENTARY';
  examName: string;
  examDate?: string | null;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  createdAt?: string;
  updatedAt?: string;
}

export interface IPgExamResult {
  id: string | number;
  student_id: string | number;
  subject_id: string | number;
  examination_id: string | number;
  internal_marks?: number | null;
  external_marks?: number | null;
  total_marks?: number | null;
  grade?: string | null;
  result_status: 'PASS' | 'FAIL' | 'ABSENT' | 'WITHHELD';
  attempt_number: number;
  created_at?: string;
  updated_at?: string;
}

export interface IPgStudentSemesterResult {
  id: string | number;
  student_id: string | number;
  academic_session_id: string | number;
  semester_id: string | number;
  examination_id: string | number;
  sgpa?: number | null;
  cgpa?: number | null;
  total_credits?: number | null;
  earned_credits?: number | null;
  overall_result?: 'PASS' | 'FAIL' | 'PROMOTED' | 'WITHHELD' | null;
  created_at?: string;
  updated_at?: string;
}

export interface IPgExcelUpload {
  id: string | number;
  file_name: string;
  file_hash?: string | null;
  examination_id?: string | number | null;
  upload_status: 'UPLOADED' | 'VALIDATING' | 'VALIDATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total_rows?: number;
  successful_rows?: number;
  failed_rows?: number;
  error_message?: string | null;
  uploaded_at?: string;
}



