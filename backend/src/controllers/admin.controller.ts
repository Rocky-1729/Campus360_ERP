import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as facultyService from '../services/faculty.service';
import * as studentService from '../services/student.service';
import * as excelService from '../services/excel.service';
import * as analyticsService from '../services/analytics.service';
import { subjectRepository } from '../repositories/subject.repository';
import { facultyRepository } from '../repositories/faculty.repository';
import { uploadRepository } from '../repositories/upload.repository';
import { auditRepository } from '../repositories/audit.repository';
import { getDBPath, closeDB, connectDB } from '../config/database';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * Get department dashboard metrics.
 */
export const getDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await analyticsService.getDepartmentAnalytics();
    res.status(200).json(ApiResponse.success(stats, 'Dashboard statistics fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Add a new faculty member.
 */
export const createFaculty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const faculty = await facultyService.createFaculty(req.body);

    // Log action to audit logs
    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Created faculty account: ${faculty.name} (${faculty.facultyId})`,
        tableName: 'faculty',
        recordId: faculty.id,
        ipAddress: req.ip,
      });
    }

    res.status(201).json(ApiResponse.created(faculty, 'Faculty created successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Edit faculty profile details.
 */
export const updateFaculty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const faculty = await facultyService.updateFaculty(id, req.body);

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Updated faculty profile: ${faculty.name}`,
        tableName: 'faculty',
        recordId: faculty.id,
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success(faculty, 'Faculty updated successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Enable/Disable a faculty account.
 */
export const toggleFaculty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await facultyService.toggleFaculty(id);

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `${result.isActive ? 'Activated' : 'Deactivated'} faculty profile ID: ${id}`,
        tableName: 'faculty',
        recordId: Number(id),
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success(result, `Faculty account is now ${result.isActive ? 'Active' : 'Disabled'}.`));
  } catch (error) {
    next(error);
  }
};

/**
 * List all faculty members.
 */
export const getAllFaculty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const list = await facultyService.getAllFaculty();
    res.status(200).json(ApiResponse.success(list, 'Faculty list fetched successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Student Master Excel.
 */
export const uploadStudents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw ApiError.badRequest('Please upload an Excel file.');
    }
    const { valid, invalid } = excelService.parseStudentExcel(req.file.buffer);
    const summary = await excelService.importStudents(valid, req.file.originalname, Number(req.user?.id));

    // Merge validation failures into summary so they render in the UI errors list
    if (invalid.length > 0) {
      summary.total += invalid.length;
      summary.failed += invalid.length;
      invalid.forEach(inv => {
        summary.errors.push({
          hallTicketNumber: `Row ${inv.row}`,
          message: inv.errors.join(', '),
        });
      });
    }

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Uploaded Student Roster sheet: ${req.file.originalname} (${summary.created + summary.updated} imported)`,
        tableName: 'students',
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success({
      summary,
      invalidRows: invalid,
    }, 'Student master file processed.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all/filtered students.
 */
export const getStudents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { section, year, search, page, limit } = req.query;
    const result = await studentService.getStudentsByFilter({
      section: section as string,
      year: year ? Number(year) : undefined,
      search: search as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(ApiResponse.success(result, 'Students fetched successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Search student by Hall Ticket.
 */
export const searchStudent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { hallTicket } = req.params;
    const profile = await studentService.getStudentByHallTicket(hallTicket);
    res.status(200).json(ApiResponse.success(profile, 'Student profile fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Marks Excel.
 */
export const uploadMarks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw ApiError.badRequest('Please upload an Excel file.');
    }
    const { academicYear, semester } = req.body;
    if (!academicYear) {
      throw ApiError.badRequest('Academic Year is required.');
    }

    const { valid, invalid } = excelService.parseMarksExcel(req.file.buffer, semester);
    const summary = await excelService.importMarks(valid, academicYear, req.file.originalname, Number(req.user?.id));

    // Merge validation failures into summary so they render in the UI errors list
    if (invalid.length > 0) {
      summary.total += invalid.length;
      summary.failed += invalid.length;
      invalid.forEach(inv => {
        summary.errors.push({
          hallTicketNumber: `Row ${inv.row}`,
          message: inv.errors.join(', '),
        });
      });
    }

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Uploaded semester marks sheet: ${req.file.originalname} (AY: ${academicYear}, ${summary.created} records)`,
        tableName: 'marks',
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success({
      summary,
      invalidRows: invalid,
    }, 'Marks spreadsheet processed.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Create a Subject.
 */
export const createSubject = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subjectCode, subjectName, credits, semester } = req.body;
    if (!subjectCode || !subjectName || !semester) {
      throw ApiError.badRequest('Subject code, name, and semester are required.');
    }

    const existing = await subjectRepository.findByCode(subjectCode);
    if (existing) {
      throw ApiError.badRequest('Subject with this code already exists.');
    }

    const subjectId = await subjectRepository.create({
      subjectCode: subjectCode.toUpperCase(),
      subjectName,
      credits: credits || 4,
      semester,
    });

    const subject = await subjectRepository.findById(subjectId);

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Created new subject: ${subjectCode} (${subjectName})`,
        tableName: 'subjects',
        recordId: subjectId,
        ipAddress: req.ip,
      });
    }

    res.status(201).json(ApiResponse.created(subject, 'Subject created successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all subjects.
 */
export const getSubjects = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { semester } = req.query;
    const subjects = await subjectRepository.findAll({
      semester: semester as string,
    });
    res.status(200).json(ApiResponse.success(subjects, 'Subjects fetched successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update a subject.
 */
export const updateSubject = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await subjectRepository.update(Number(id), req.body);
    const subject = await subjectRepository.findById(Number(id));
    if (!subject) throw ApiError.notFound('Subject not found.');

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Updated subject details for: ${subject.subjectCode}`,
        tableName: 'subjects',
        recordId: Number(id),
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success(subject, 'Subject updated successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a subject (Soft Delete).
 */
export const deleteSubject = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await subjectRepository.softDelete(Number(id));

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Deactivated subject ID: ${id}`,
        tableName: 'subjects',
        recordId: Number(id),
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success(null, 'Subject deleted successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Create a Faculty Assignment.
 */
export const createAssignment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { facultyId, subjectId, section, semester } = req.body;
    if (!facultyId || !subjectId || !section || !semester) {
      throw ApiError.badRequest('All fields are required.');
    }

    const assignmentId = await facultyRepository.createAssignment({
      facultyId: Number(facultyId),
      subjectId: Number(subjectId),
      section,
      semester,
    });

    const list = await facultyRepository.getAssignments({ facultyId: Number(facultyId) });
    const assignment = list.find((a) => a.id === assignmentId);

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Assigned faculty ID ${facultyId} to subject ID ${subjectId} (Section: ${section})`,
        tableName: 'faculty_assignments',
        recordId: assignmentId,
        ipAddress: req.ip,
      });
    }

    res.status(201).json(ApiResponse.created(assignment, 'Faculty assigned successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * List all Assignments.
 */
export const getAssignments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignments = await facultyRepository.getAssignments();
    res.status(200).json(ApiResponse.success(assignments, 'Assignments fetched successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Assignment.
 */
export const deleteAssignment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await facultyRepository.deleteAssignment(Number(id));

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Removed faculty assignment ID: ${id}`,
        tableName: 'faculty_assignments',
        recordId: Number(id),
        ipAddress: req.ip,
      });
    }

    res.status(200).json(ApiResponse.success(null, 'Assignment deleted successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get department analytics.
 */
export const getAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const analytics = await analyticsService.getDepartmentAnalytics();
    res.status(200).json(ApiResponse.success(analytics, 'Department analytics fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Download SQLite Database backup file.
 * Generates filename format: campus360_backup_YYYY_MM_DD_HH_MM.db
 */
export const backupDb = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dbPath = getDBPath();
    if (!fs.existsSync(dbPath)) {
      throw ApiError.notFound('Database file not found on server disk.');
    }

    const now = new Date();
    const dateStr = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const filename = `campus360_backup_${dateStr}.db`;

    logger.info(`Database backup triggered. Streaming: ${filename}`);
    
    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Generated database backup download: ${filename}`,
        tableName: 'system',
        ipAddress: req.ip,
      });
    }

    res.download(dbPath, filename);
  } catch (error) {
    next(error);
  }
};

/**
 * Restore SQLite Database from uploaded file.
 */
export const restoreDb = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw ApiError.badRequest('Please upload a backup database file.');
    }

    const dbPath = getDBPath();
    logger.warn(`RESTORE DATABASE: overwriting ${dbPath} with uploaded file: ${req.file.originalname}`);

    // Close SQLite connection before overwriting file
    await closeDB();

    // Overwrite database file
    fs.writeFileSync(dbPath, req.file.buffer);

    // Re-open SQLite connection
    await connectDB();

    if (req.user) {
      await auditRepository.log({
        userId: Number(req.user.id),
        username: req.user.username || 'admin',
        role: 'admin',
        action: `Restored database backup from file: ${req.file.originalname}`,
        tableName: 'system',
        ipAddress: req.ip,
      });
    }

    // Force flush cache after restore
    await analyticsService.flushAnalyticsCache();

    res.status(200).json(ApiResponse.success(null, 'Database backup restored successfully.'));
  } catch (error) {
    // If overwrite fails, attempt to re-open connection in whatever state
    await connectDB();
    next(error);
  }
};

/**
 * Get upload history logs.
 */
export const getUploadHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const list = await uploadRepository.getHistory();
    res.status(200).json(ApiResponse.success(list, 'Upload history logs fetched.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent system audit logs.
 */
export const getAuditLogs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const list = await auditRepository.findRecent(50);
    res.status(200).json(ApiResponse.success(list, 'Recent audit logs fetched.'));
  } catch (error) {
    next(error);
  }
};
