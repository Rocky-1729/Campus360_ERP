import { pgAttendanceRepository } from '../repositories/pgAttendance.repository';
import { pgStudentRepository } from '../repositories/pgStudent.repository';
import { attendanceRepository as sqliteAttendanceRepo } from '../repositories/attendance.repository';
import * as db from '../config/database';
import { getSqliteDB } from '../config/sqliteDatabase';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

/** Single attendance record input */
export interface AttendanceRecordInput {
  hallTicketNumber: string;
  subjectId: string | number;
  facultyId?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused' | 'Present' | 'Absent' | 'Late' | 'Excused';
  semester?: string;
  section?: string | number;
  periodNumber?: number;
}

/** Attendance summary shape matching frontend types */
export interface AttendanceSummary {
  overall: {
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number | null;
  };
  subjectWise: Array<{
    subjectId: string;
    subjectName: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number | null;
  }>;
}

/** Helper to resolve sectionId from string or number */
export const resolveSectionId = async (sectionInput?: string | number): Promise<number> => {
  if (!sectionInput) return 1;
  if (typeof sectionInput === 'number' || !isNaN(Number(sectionInput))) {
    return Number(sectionInput);
  }

  const cleanSec = String(sectionInput).trim();
  const res = await db.query(
    'SELECT id FROM sections WHERE UPPER(section_name) = UPPER($1) LIMIT 1',
    [cleanSec]
  );
  if (res.rows.length > 0) {
    return Number(res.rows[0].id);
  }
  return 1;
};

/** Helper to resolve subjectId from string or number */
export const resolveSubjectId = async (subjectInput: string | number): Promise<number> => {
  if (typeof subjectInput === 'number' || !isNaN(Number(subjectInput))) {
    return Number(subjectInput);
  }

  const cleanSub = String(subjectInput).trim();
  const res = await db.query(
    'SELECT id FROM subjects WHERE UPPER(subject_code) = UPPER($1) LIMIT 1',
    [cleanSub]
  );
  if (res.rows.length > 0) {
    return Number(res.rows[0].id);
  }
  return 1;
};

/**
 * Bulk marks attendance records in PostgreSQL.
 * If session is locked, rejects with 403.
 * Supports idempotent UPSERT.
 */
export const markAttendance = async (
  records: AttendanceRecordInput[],
  facultyUserId?: number
): Promise<{ inserted: number; updated: number; skipped: number }> => {
  try {
    if (!Array.isArray(records) || records.length === 0) {
      return { inserted: 0, updated: 0, skipped: 0 };
    }

    const first = records[0];
    const sectionId = await resolveSectionId(first.section);
    const subjectId = await resolveSubjectId(first.subjectId);
    const sessionDate = first.date;
    const periodNumber = first.periodNumber || 1;

    // 1. Find or create the master session in PostgreSQL
    const session = await pgAttendanceRepository.findOrCreateSession({
      sectionId,
      subjectId,
      sessionDate,
      periodNumber,
      facultyUserId,
    });

    // 2. Check if session is locked
    if (session.is_locked) {
      throw ApiError.forbidden('Attendance register for this session is locked. Edits are disabled.');
    }

    // 3. Prepare records for insertion
    let skipped = 0;
    const recordsToUpsert: Array<{
      studentId: number;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    }> = [];

    for (const r of records) {
      const ht = (r.hallTicketNumber || '').trim().toUpperCase();
      if (!ht) {
        skipped++;
        continue;
      }

      // Find student in PostgreSQL
      const student = await pgStudentRepository.findStudentById(ht);
      if (student && student.id) {
        const rawStatus = (r.status || 'present').toUpperCase();
        const status = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(rawStatus)
          ? (rawStatus as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED')
          : 'PRESENT';

        recordsToUpsert.push({
          studentId: Number(student.id),
          status,
        });
      } else {
        // Fallback to SQLite if student not yet in PostgreSQL
        try {
          await sqliteAttendanceRepo.upsert({
            hallTicketNumber: ht,
            subjectId: Number(subjectId),
            status: r.status.toLowerCase() as any,
            date: r.date,
            semester: r.semester || '1-1',
            section: String(r.section || 'A'),
          });
        } catch {
          skipped++;
        }
      }
    }

    // 4. Batch upsert into PostgreSQL attendance_records
    const res = await pgAttendanceRepository.upsertRecords(session.id, recordsToUpsert);

    return {
      inserted: res.inserted,
      updated: res.updated,
      skipped,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Mark attendance error:', error);
    throw ApiError.internal('An error occurred while marking attendance.');
  }
};

/**
 * Update single attendance record status.
 */
export const updateAttendance = async (
  id: string,
  status: 'present' | 'absent' | 'late' | 'excused'
): Promise<any> => {
  try {
    const numId = Number(id);
    if (!isNaN(numId)) {
      // Check PostgreSQL attendance_records
      const recRes = await db.query(
        'SELECT ar.*, sess.is_locked FROM attendance_records ar JOIN attendance_sessions sess ON ar.attendance_session_id = sess.id WHERE ar.id = $1',
        [numId]
      );
      if (recRes.rows.length > 0) {
        const row = recRes.rows[0];
        if (row.is_locked) {
          throw ApiError.forbidden('Attendance register for this session is locked.');
        }

        const updateRes = await db.query(
          'UPDATE attendance_records SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
          [status.toUpperCase(), numId]
        );
        return updateRes.rows[0];
      }
    }

    // Fallback: Check SQLite
    const sdb = await getSqliteDB();
    const existing = await sdb.get('SELECT * FROM attendance WHERE id = ?', [numId]);
    if (!existing) {
      throw ApiError.notFound('Attendance record not found.');
    }

    await sdb.run('UPDATE attendance SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [
      status.toLowerCase(),
      numId,
    ]);
    return sdb.get('SELECT * FROM attendance WHERE id = ?', [numId]);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Update attendance error:', error);
    throw ApiError.internal('An error occurred while updating attendance.');
  }
};

/**
 * Retrieves chronological attendance history for a student.
 */
export const getAttendanceByHallTicket = async (
  hallTicket: string,
  _semester?: string,
  subjectId?: string
): Promise<any[]> => {
  try {
    const ht = hallTicket.trim().toUpperCase();

    // 1. Try PostgreSQL student
    const student = await pgStudentRepository.findStudentById(ht);
    if (student && student.id) {
      const records = await pgAttendanceRepository.getStudentHistory(Number(student.id), {
        subjectId: subjectId ? Number(subjectId) : undefined,
      });
      if (records.length > 0) {
        return records;
      }
    }

    // 2. Fallback to legacy SQLite attendance records
    const sqliteRecords = await sqliteAttendanceRepo.getStudentHistory(ht);
    return sqliteRecords.map((r: any) => ({
      _id: String(r.id),
      hallTicketNumber: r.hallTicketNumber,
      subjectId: {
        _id: String(r.subjectId),
        subjectCode: r.subjectCode || 'SUB',
        subjectName: r.subjectName || 'Subject',
      },
      status: (r.status || 'present').toLowerCase(),
      date: r.date,
      semester: r.semester,
      section: r.section,
    }));
  } catch (error) {
    logger.error('Get attendance by hall ticket error:', error);
    throw ApiError.internal('An error occurred while fetching attendance.');
  }
};

/**
 * Calculates overall and subject-wise attendance percentage for a student.
 */
export const getAttendanceSummary = async (
  hallTicket: string
): Promise<AttendanceSummary> => {
  try {
    const ht = hallTicket.trim().toUpperCase();

    // 1. Try PostgreSQL
    const student = await pgStudentRepository.findStudentById(ht);
    if (student && student.id) {
      const summary = await pgAttendanceRepository.getStudentSummary(Number(student.id));
      if (summary.overall.total > 0) {
        return summary;
      }
    }

    // 2. Fallback to legacy SQLite
    return await sqliteAttendanceRepo.getSubjectSummary(ht).then((subjectRows: any[]) => {
      let total = 0;
      let present = 0;
      let absent = 0;
      let late = 0;

      subjectRows.forEach((r) => {
        total += r.total || 0;
        present += r.present || 0;
        absent += r.absent || 0;
        late += r.late || 0;
      });

      const effective = present + (late * 0.5);
      const percentage = total > 0 ? Math.round((effective / total) * 100) : null;

      return {
        overall: { total, present, absent, late, percentage },
        subjectWise: subjectRows.map((s) => ({
          subjectId: String(s.subjectId),
          subjectName: s.subjectName || s.subjectCode || 'Subject',
          total: s.total || 0,
          present: s.present || 0,
          absent: s.absent || 0,
          late: s.late || 0,
          percentage: (s.total && s.total > 0) ? Math.round(((s.present + (s.late * 0.5)) / s.total) * 100) : null,
        })),
      };
    });
  } catch (error) {
    logger.error('Get attendance summary error:', error);
    throw ApiError.internal('An error occurred while fetching attendance summary.');
  }
};

/**
 * Returns student checklist for faculty marking.
 */
export const getAttendanceForMarking = async (
  facultyId: string,
  subjectId: string,
  section: string,
  date: string,
  periodNumber: number = 1
): Promise<Array<{
  hallTicketNumber: string;
  name: string;
  status: string | null;
  attendanceId: string | null;
}>> => {
  try {
    const sectionId = await resolveSectionId(section);
    const subId = await resolveSubjectId(subjectId);

    // 1. Try PostgreSQL checklist
    const checklist = await pgAttendanceRepository.getSectionChecklist(
      subId,
      sectionId,
      date,
      periodNumber
    );

    if (checklist.length > 0) {
      return checklist.map((c) => ({
        hallTicketNumber: c.hallTicketNumber,
        name: c.name,
        status: c.status || null,
        attendanceId: c.attendanceRecordId ? String(c.attendanceRecordId) : null,
      }));
    }

    // 2. Fallback to SQLite students
    const sdb = await getSqliteDB();
    const students = await sdb.all<any>(
      'SELECT hallTicketNumber, name FROM students WHERE section = ? AND isActive = 1 ORDER BY hallTicketNumber ASC',
      [section]
    );

    const legacyList: any[] = [];
    for (const student of students) {
      const att = await sdb.get<any>(
        'SELECT id, status FROM attendance WHERE UPPER(hallTicketNumber) = ? AND subjectId = ? AND date = ?',
        [student.hallTicketNumber.toUpperCase(), Number(subId), date]
      );
      legacyList.push({
        hallTicketNumber: student.hallTicketNumber,
        name: student.name,
        status: att?.status ? att.status.toLowerCase() : null,
        attendanceId: att?.id ? String(att.id) : null,
      });
    }

    return legacyList;
  } catch (error) {
    logger.error('Get attendance for marking error:', error);
    throw ApiError.internal('An error occurred while fetching attendance for marking.');
  }
};
