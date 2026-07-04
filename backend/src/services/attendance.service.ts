import { attendanceRepository } from '../repositories/attendance.repository';
import { studentRepository } from '../repositories/student.repository';
import * as db from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { IAttendance } from '../interfaces/db.interface';

/** Single attendance record input */
interface AttendanceRecord {
  hallTicketNumber: string;
  subjectId: string;
  facultyId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  semester?: string;
  section?: string;
}

/** Attendance summary for a student */
interface AttendanceSummary {
  overall: {
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  };
  subjectWise: Array<{
    subjectId: string;
    subjectName: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  }>;
}

/**
 * Bulk insert attendance records in SQLite.
 * Skips duplicates.
 * @param records - Array of attendance records
 * @returns Insert summary
 */
export const markAttendance = async (
  records: AttendanceRecord[]
): Promise<{ inserted: number; skipped: number }> => {
  try {
    let inserted = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        const existing = await db.get(
          'SELECT id FROM attendance WHERE UPPER(hallTicketNumber) = ? AND subjectId = ? AND date = ?',
          [record.hallTicketNumber.toUpperCase(), Number(record.subjectId), record.date]
        );

        if (existing) {
          skipped++;
        } else {
          await attendanceRepository.create({
            hallTicketNumber: record.hallTicketNumber,
            subjectId: Number(record.subjectId),
            status: record.status,
            date: record.date,
            semester: record.semester || '1-1',
            section: record.section || 'A',
          });
          inserted++;
        }
      } catch (err) {
        skipped++;
      }
    }

    return { inserted, skipped };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Mark attendance error:', error);
    throw ApiError.internal('An error occurred while marking attendance.');
  }
};

/**
 * Update a single attendance record's status.
 * @param id - Attendance record ID
 * @param status - New status value
 * @returns Updated attendance record
 */
export const updateAttendance = async (
  id: string,
  status: 'present' | 'absent' | 'late'
): Promise<IAttendance> => {
  try {
    const existing = await db.get<IAttendance>('SELECT * FROM attendance WHERE id = ?', [Number(id)]);
    if (!existing) {
      throw ApiError.notFound('Attendance record not found.');
    }

    await db.run('UPDATE attendance SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [
      status,
      Number(id),
    ]);

    const updated = await db.get<IAttendance>('SELECT * FROM attendance WHERE id = ?', [Number(id)]);
    return updated!;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Update attendance error:', error);
    throw ApiError.internal('An error occurred while updating attendance.');
  }
};

/**
 * Get attendance records for a student, optionally filtered by semester and subject.
 */
export const getAttendanceByHallTicket = async (
  hallTicket: string,
  semester?: string,
  subjectId?: string
): Promise<any[]> => {
  try {
    let sql = `
      SELECT a.*, s.subjectCode, s.subjectName 
      FROM attendance a
      JOIN subjects s ON a.subjectId = s.id
      WHERE UPPER(a.hallTicketNumber) = ?
    `;
    const params: any[] = [hallTicket.toUpperCase().trim()];

    if (semester) {
      sql += ' AND a.semester = ?';
      params.push(semester);
    }
    if (subjectId) {
      sql += ' AND a.subjectId = ?';
      params.push(Number(subjectId));
    }

    sql += ' ORDER BY a.date DESC';
    const records = await db.all<any>(sql, params);

    return records.map((r) => ({
      _id: String(r.id),
      hallTicketNumber: r.hallTicketNumber,
      subjectId: {
        _id: String(r.subjectId),
        subjectCode: r.subjectCode,
        subjectName: r.subjectName,
      },
      status: r.status,
      date: r.date,
      semester: r.semester,
      section: r.section,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    logger.error('Get attendance by hall ticket error:', error);
    throw ApiError.internal('An error occurred while fetching attendance.');
  }
};

/**
 * Get overall and subject-wise attendance percentage for a student.
 */
export const getAttendanceSummary = async (
  hallTicket: string
): Promise<AttendanceSummary> => {
  try {
    const records = await attendanceRepository.getStudentHistory(hallTicket);
    const total = records.length;
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const percentage = total > 0 ? Math.round(((present + (late * 0.5)) / total) * 100) : 0;

    // Group by subject in JS
    const subjectMap: Record<string, {
      subjectId: string;
      subjectName: string;
      total: number;
      present: number;
      absent: number;
      late: number;
    }> = {};

    for (const record of records) {
      const subId = String(record.subjectId);
      if (!subjectMap[subId]) {
        subjectMap[subId] = {
          subjectId: subId,
          subjectName: record.subjectName || record.subjectCode || subId,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
        };
      }

      subjectMap[subId].total++;
      if (record.status === 'present') subjectMap[subId].present++;
      else if (record.status === 'absent') subjectMap[subId].absent++;
      else if (record.status === 'late') subjectMap[subId].late++;
    }

    const subjectWise = Object.values(subjectMap).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round(((s.present + (s.late * 0.5)) / s.total) * 100) : 0,
    }));

    return {
      overall: { total, present, absent, late, percentage },
      subjectWise,
    };
  } catch (error) {
    logger.error('Get attendance summary error:', error);
    throw ApiError.internal('An error occurred while fetching attendance summary.');
  }
};

/**
 * Get student list with attendance status for a specific day.
 */
export const getAttendanceForMarking = async (
  facultyId: string,
  subjectId: string,
  section: string,
  date: string
): Promise<Array<{
  hallTicketNumber: string;
  name: string;
  status: string | null;
  attendanceId: string | null;
}>> => {
  try {
    const students = await db.all<any>(
      'SELECT hallTicketNumber, name FROM students WHERE section = ? AND isActive = 1 ORDER BY hallTicketNumber ASC',
      [section]
    );

    const checklist: any[] = [];
    for (const student of students) {
      const att = await db.get<any>(
        'SELECT id, status FROM attendance WHERE UPPER(hallTicketNumber) = ? AND subjectId = ? AND date = ?',
        [student.hallTicketNumber.toUpperCase(), Number(subjectId), date]
      );
      checklist.push({
        hallTicketNumber: student.hallTicketNumber,
        name: student.name,
        status: att?.status || null,
        attendanceId: att?.id ? String(att.id) : null,
      });
    }

    return checklist;
  } catch (error) {
    logger.error('Get attendance for marking error:', error);
    throw ApiError.internal('An error occurred while fetching attendance for marking.');
  }
};
