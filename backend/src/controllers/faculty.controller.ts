import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { facultyRepository } from '../repositories/faculty.repository';
import { studentRepository } from '../repositories/student.repository';
import { attendanceRepository } from '../repositories/attendance.repository';
import { auditRepository } from '../repositories/audit.repository';
import * as studentService from '../services/student.service';
import * as attendanceService from '../services/attendance.service';
import * as certificateService from '../services/certificate.service';
import * as achievementService from '../services/achievement.service';
import * as analyticsService from '../services/analytics.service';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import * as db from '../config/database';

/**
 * Helper to get Faculty record from req.user
 */
const getFacultyByUserId = async (userId: string) => {
  const faculty = await facultyRepository.findByUserId(Number(userId));
  if (!faculty) {
    throw ApiError.forbidden('Faculty profile not found.');
  }
  return faculty;
};

/**
 * Helper to verify if student is assigned to this faculty (based on student section)
 */
const checkStudentAssignment = async (facultyId: number, studentSection: string): Promise<boolean> => {
  const list = await facultyRepository.getAssignments({ facultyId });
  const assignment = list.find((a) => a.section === studentSection);
  return !!assignment;
};

/**
 * Get Faculty dashboard stats.
 */
export const getDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const faculty = await getFacultyByUserId(req.user.id);
    const analytics = await analyticsService.getFacultyAnalytics(String(faculty.id), {});
    res.status(200).json(ApiResponse.success(analytics, 'Faculty dashboard stats fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get students assigned to this faculty.
 */
export const getStudents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const faculty = await getFacultyByUserId(req.user.id);

    // Get assignments to find sections
    const assignments = await facultyRepository.getAssignments({ facultyId: faculty.id });
    const sections = [...new Set(assignments.map((a) => a.section))];

    if (sections.length === 0) {
      res.status(200).json(ApiResponse.success([], 'No assigned sections found.'));
      return;
    }

    // Fetch students in these sections
    const students = await db.all<any>(
      `SELECT * FROM students WHERE section IN (${sections.map(() => '?').join(',')}) AND isActive = 1 ORDER BY hallTicketNumber ASC`,
      sections
    );

    res.status(200).json(ApiResponse.success(students, 'Assigned students fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Search student by Hall Ticket (with section checks).
 */
export const searchStudent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const { hallTicket } = req.params;
    const faculty = await getFacultyByUserId(req.user.id);

    const student = await studentRepository.findByHallTicket(hallTicket);
    if (!student) {
      throw ApiError.notFound('Student not found.');
    }

    const isAssigned = await checkStudentAssignment(faculty.id!, student.section || '');
    if (!isAssigned && req.user.role !== 'admin') {
      throw ApiError.forbidden('You are not authorized to access this student.');
    }

    res.status(200).json(ApiResponse.success(student, 'Student found.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Student Profile (with section checks).
 */
export const getStudentProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const { hallTicket } = req.params;
    const faculty = await getFacultyByUserId(req.user.id);

    const student = await studentRepository.findByHallTicket(hallTicket);
    if (!student) {
      throw ApiError.notFound('Student not found.');
    }

    const isAssigned = await checkStudentAssignment(faculty.id!, student.section || '');
    if (!isAssigned && req.user.role !== 'admin') {
      throw ApiError.forbidden('You are not authorized to access this student.');
    }

    const profile = await studentService.getStudentByHallTicket(hallTicket);
    res.status(200).json(ApiResponse.success(profile, 'Student profile fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Mark Attendance.
 */
export const markAttendance = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const faculty = await getFacultyByUserId(req.user.id);

    const records = req.body;
    if (!Array.isArray(records)) {
      throw ApiError.badRequest('Body must be an array of attendance records.');
    }

    if (records.length > 0) {
      const first = records[0];
      // Check if attendance is locked
      const isLocked = await attendanceRepository.isLocked(Number(first.subjectId), first.date, first.section);
      if (isLocked) {
        throw ApiError.forbidden('Attendance register is locked by Department HOD. Edit is disabled.');
      }
    }

    const recordsWithFaculty = records.map((r) => ({
      ...r,
      facultyId: String(faculty.id),
    }));

    const result = await attendanceService.markAttendance(recordsWithFaculty);

    // Save audit log
    if (records.length > 0 && req.user) {
      const first = records[0];
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'faculty',
        role: 'faculty',
        action: `Marked/Submitted Attendance for Subject ID ${first.subjectId} (Section: ${first.section}, Date: ${first.date})`,
        tableName: 'attendance',
        ipAddress: req.ip,
      });

      // Default: Lock attendance automatically on submit!
      await attendanceRepository.lock(Number(first.subjectId), first.date, first.section, Number(req.user.id));
    }

    res.status(200).json(ApiResponse.success(result, 'Attendance marked and locked successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Edit single attendance record.
 */
export const updateAttendance = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      throw ApiError.badRequest('Status is required.');
    }

    // Find attendance record to check lock
    const record = await db.get<any>('SELECT * FROM attendance WHERE id = ?', [id]);
    if (record) {
      const isLocked = await attendanceRepository.isLocked(record.subjectId, record.date, record.section);
      if (isLocked) {
        throw ApiError.forbidden('Attendance register is locked by Department HOD.');
      }
    }

    const result = await attendanceService.updateAttendance(id, status);

    if (req.user && record) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'faculty',
        role: 'faculty',
        action: `Edited Attendance status for student ${record.hallTicketNumber} (Date: ${record.date}) to ${status}`,
        tableName: 'attendance',
        recordId: Number(id),
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success(result, 'Attendance updated successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of students in section for attendance marking.
 */
export const getAttendanceForMarking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const faculty = await getFacultyByUserId(req.user.id);
    const { subjectId, section, date } = req.query;

    if (!subjectId || !section || !date) {
      throw ApiError.badRequest('Subject ID, section, and date are required.');
    }

    const list = await attendanceService.getAttendanceForMarking(
      String(faculty.id),
      subjectId as string,
      section as string,
      date as string
    );

    const isLocked = await attendanceRepository.isLocked(Number(subjectId), date as string, section as string);

    res.status(200).json(ApiResponse.success({
      list,
      isLocked,
    }, 'Students attendance list fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Pending Certificates for review.
 */
export const getPendingCertificates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const faculty = await getFacultyByUserId(req.user.id);

    // Get sections
    const assignments = await facultyRepository.getAssignments({ facultyId: faculty.id });
    const sections = [...new Set(assignments.map((a) => a.section))];

    if (sections.length === 0) {
      res.status(200).json(ApiResponse.success([], 'No assigned sections found.'));
      return;
    }

    // Find students in these sections
    const students = await db.all<{ hallTicketNumber: string }>(
      `SELECT hallTicketNumber FROM students WHERE section IN (${sections.map(() => '?').join(',')}) AND isActive = 1`,
      sections
    );
    const hallTickets = students.map((s) => s.hallTicketNumber);

    const certs = await certificateService.getPendingCertificates({ hallTicketNumbers: hallTickets });
    res.status(200).json(ApiResponse.success(certs, 'Pending certificates fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Review (Approve/Reject) a certificate.
 */
export const reviewCertificate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status || (status !== 'approved' && status !== 'rejected')) {
      throw ApiError.badRequest('Invalid status. Must be approved or rejected.');
    }

    const result = await certificateService.updateCertificateStatus(
      id,
      status,
      remarks || '',
      req.user.id
    );

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'faculty',
        role: 'faculty',
        action: `Reviewed Certificate ID: ${id} status to ${status}`,
        tableName: 'certificates',
        recordId: Number(id),
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success(result, `Certificate status updated to ${status}.`));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Pending Achievements for review.
 */
export const getPendingAchievements = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const faculty = await getFacultyByUserId(req.user.id);

    // Get sections
    const assignments = await facultyRepository.getAssignments({ facultyId: faculty.id });
    const sections = [...new Set(assignments.map((a) => a.section))];

    if (sections.length === 0) {
      res.status(200).json(ApiResponse.success([], 'No assigned sections.'));
      return;
    }

    // Find students in these sections
    const students = await db.all<{ hallTicketNumber: string }>(
      `SELECT hallTicketNumber FROM students WHERE section IN (${sections.map(() => '?').join(',')}) AND isActive = 1`,
      sections
    );
    const hallTickets = students.map((s) => s.hallTicketNumber);

    const achievements = await achievementService.getPendingAchievements({ hallTicketNumbers: hallTickets });
    res.status(200).json(ApiResponse.success(achievements, 'Pending achievements fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Review (Approve/Reject) an achievement.
 */
export const reviewAchievement = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status || (status !== 'approved' && status !== 'rejected')) {
      throw ApiError.badRequest('Invalid status. Must be approved or rejected.');
    }

    const result = await achievementService.updateAchievementStatus(
      id,
      status,
      remarks || '',
      req.user.id
    );

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'faculty',
        role: 'faculty',
        action: `Reviewed Achievement ID: ${id} status to ${status}`,
        tableName: 'achievements',
        recordId: Number(id),
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success(result, `Achievement status updated to ${status}.`));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Faculty Analytics scoped to assigned students.
 */
export const getAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const faculty = await getFacultyByUserId(req.user.id);
    const { section, semester, subjectCode, academicYear } = req.query;

    const stats = await analyticsService.getFacultyAnalytics(String(faculty.id), {
      section: section as string,
      semester: semester as string,
      subjectCode: subjectCode as string,
      academicYear: academicYear as string,
    });

    res.status(200).json(ApiResponse.success(stats, 'Faculty analytics fetched.'));
  } catch (error) {
    next(error);
  }
};
