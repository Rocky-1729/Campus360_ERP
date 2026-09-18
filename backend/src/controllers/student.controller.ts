import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { studentRepository } from '../repositories/student.repository';
import { pgStudentRepository } from '../repositories/pgStudent.repository';
import { auditRepository } from '../repositories/audit.repository';
import * as studentService from '../services/student.service';
import * as marksService from '../services/marks.service';
import * as attendanceService from '../services/attendance.service';
import * as certificateService from '../services/certificate.service';
import * as achievementService from '../services/achievement.service';
import * as notificationService from '../services/notification.service';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';

/**
 * Helper to fetch Student record from req.user
 */
const getStudentByUserId = async (userId: string | number, username?: string) => {
  try {
    const student = await studentRepository.findByUserId(Number(userId));
    if (student) return student;
  } catch {
    // ignore
  }

  if (username) {
    const pgStudent = await pgStudentRepository.findStudentById(username);
    if (pgStudent) {
      return {
        id: Number(pgStudent.id),
        userId: Number(userId),
        hallTicketNumber: pgStudent.hallTicketNumber,
        name: pgStudent.name,
        department: pgStudent.departmentName || pgStudent.departmentCode || 'CSE',
        year: 1,
        semester: '1-1',
        section: pgStudent.sectionName || 'A',
        isActive: 1,
      };
    }
  }

  throw ApiError.forbidden('Student profile not found.');
};

/**
 * Get Student dashboard.
 */
export const getDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const student = await getStudentByUserId(req.user.id, req.user.username);

    // Fetch marks summary for CGPA / SGPA
    const marksSummary = await marksService.getMarksSummary(student.hallTicketNumber);
    const latestSem = marksSummary.length > 0 ? marksSummary[marksSummary.length - 1] : null;

    const currentSgpa = latestSem ? latestSem.sgpa : 0;
    const currentCgpa = latestSem ? latestSem.cgpa : 0;

    // Fetch attendance summary
    const attendanceSummary = await attendanceService.getAttendanceSummary(student.hallTicketNumber);
    const overallAttendance = attendanceSummary.overall.percentage;

    // Fetch recent notifications (limit to 5)
    const notifications = await notificationService.getNotifications(req.user.id, req.user.role);
    const recentNotifications = notifications.slice(0, 5);

    // Fetch timeline
    const timeline = await studentRepository.getTimeline(student.hallTicketNumber);

    res.status(200).json(
      ApiResponse.success({
        studentName: student.name,
        hallTicketNumber: student.hallTicketNumber,
        currentSgpa,
        currentCgpa,
        overallAttendance,
        recentNotifications,
        timeline,
      }, 'Student dashboard statistics fetched.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Student own profile.
 */
export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const profile = await studentService.getStudentProfile(req.user.id);
    res.status(200).json(ApiResponse.success(profile, 'Student profile fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Student semester-wise marks.
 */
export const getMarks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const student = await getStudentByUserId(req.user.id, req.user.username);
    const { semester } = req.query;

    const marks = await marksService.getMarksByHallTicket(
      student.hallTicketNumber,
      semester as string
    );
    const summary = await marksService.getMarksSummary(student.hallTicketNumber);

    res.status(200).json(
      ApiResponse.success({
        marks,
        summary,
      }, 'Student marks fetched.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Student attendance.
 */
export const getAttendance = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const student = await getStudentByUserId(req.user.id, req.user.username);
    const { semester, subjectId } = req.query;

    const records = await attendanceService.getAttendanceByHallTicket(
      student.hallTicketNumber,
      semester as string,
      subjectId as string
    );
    const summary = await attendanceService.getAttendanceSummary(student.hallTicketNumber);

    res.status(200).json(
      ApiResponse.success({
        records,
        summary,
      }, 'Student attendance records fetched.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a Certificate.
 */
export const uploadCertificate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const student = await getStudentByUserId(req.user.id, req.user.username);

    const { type, title, issuingOrganization, issueDate } = req.body;
    if (!type || !title) {
      throw ApiError.badRequest('Type and title are required.');
    }

    const certificate = await certificateService.createCertificate(
      {
        hallTicketNumber: student.hallTicketNumber,
        type,
        title,
        issuingOrganization,
        issueDate,
      },
      req.file
    );

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'student',
        role: 'student',
        action: `Uploaded Certificate: ${title}`,
        tableName: 'certificates',
        recordId: certificate.id,
        ipAddress: req.ip,
      });
    }

    res.status(201).json(ApiResponse.created(certificate, 'Certificate uploaded successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get own certificates list.
 */
export const getCertificates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const student = await getStudentByUserId(req.user.id, req.user.username);

    const certs = await certificateService.getCertificatesByHallTicket(student.hallTicketNumber);
    res.status(200).json(ApiResponse.success(certs, 'Certificates fetched successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Upload an Achievement.
 */
export const uploadAchievement = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const student = await getStudentByUserId(req.user.id, req.user.username);

    const { category, title, description, date } = req.body;
    if (!category || !title) {
      throw ApiError.badRequest('Category and title are required.');
    }

    const achievement = await achievementService.createAchievement(
      {
        hallTicketNumber: student.hallTicketNumber,
        category,
        title,
        description,
        date,
      },
      req.file
    );

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'student',
        role: 'student',
        action: `Uploaded Achievement: ${title}`,
        tableName: 'achievements',
        recordId: achievement.id,
        ipAddress: req.ip,
      });
    }

    res.status(201).json(ApiResponse.created(achievement, 'Achievement uploaded successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get own achievements list.
 */
export const getAchievements = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const student = await getStudentByUserId(req.user.id, req.user.username);

    const achievements = await achievementService.getAchievementsByHallTicket(student.hallTicketNumber);
    res.status(200).json(ApiResponse.success(achievements, 'Achievements fetched successfully.'));
  } catch (error) {
    next(error);
  }
};
