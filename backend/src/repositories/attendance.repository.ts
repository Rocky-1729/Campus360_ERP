import { query } from '../config/database';
import { getSqliteDB } from '../config/sqliteDatabase';
import { IAttendance, IAttendanceLock } from '../interfaces/db.interface';
import { pgAttendanceRepository } from './pgAttendance.repository';
import { pgStudentRepository } from './pgStudent.repository';
import { logger } from '../utils/logger';

export const attendanceRepository = {
  create: async (att: IAttendance): Promise<number> => {
    try {
      const sdb = await getSqliteDB();
      const res = await sdb.run(
        'INSERT INTO attendance (hallTicketNumber, subjectId, status, date, semester, section) VALUES (?, ?, ?, ?, ?, ?)',
        [
          att.hallTicketNumber.toUpperCase().trim(),
          att.subjectId,
          att.status,
          att.date,
          att.semester,
          att.section,
        ]
      );
      return res.lastID!;
    } catch (err) {
      logger.warn('SQLite attendance create fallback error:', err);
      return 0;
    }
  },

  upsert: async (att: IAttendance): Promise<void> => {
    try {
      const sdb = await getSqliteDB();
      const existing = await sdb.get<IAttendance>(
        'SELECT id FROM attendance WHERE UPPER(hallTicketNumber) = ? AND subjectId = ? AND date = ?',
        [att.hallTicketNumber.toUpperCase().trim(), att.subjectId, att.date]
      );

      if (existing && existing.id) {
        await sdb.run('UPDATE attendance SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [
          att.status,
          existing.id,
        ]);
      } else {
        await attendanceRepository.create(att);
      }
    } catch (err) {
      logger.warn('SQLite attendance upsert fallback error:', err);
    }
  },

  getStudentHistory: async (hallTicketNumber: string): Promise<IAttendance[]> => {
    const ht = hallTicketNumber.toUpperCase().trim();
    try {
      const student = await pgStudentRepository.findStudentById(ht);
      if (student && student.id) {
        const records = await pgAttendanceRepository.getStudentHistory(Number(student.id));
        if (records.length > 0) {
          return records.map((r) => ({
            id: Number(r._id),
            hallTicketNumber: ht,
            subjectId: Number(r.subjectId._id),
            status: r.status,
            date: r.date,
            semester: '1-1',
            section: r.section || 'A',
            subjectCode: r.subjectId.subjectCode,
            subjectName: r.subjectId.subjectName,
          })) as any[];
        }
      }
    } catch (err) {
      logger.warn('PostgreSQL getStudentHistory error, checking SQLite:', err);
    }

    try {
      const sdb = await getSqliteDB();
      const rows = await sdb.all<any[]>(
        `SELECT a.*, s.subjectCode, s.subjectName 
         FROM attendance a
         JOIN subjects s ON a.subjectId = s.id
         WHERE UPPER(a.hallTicketNumber) = ?
         ORDER BY a.date DESC`,
        [ht]
      );
      return (rows || []) as IAttendance[];
    } catch {
      return [];
    }
  },

  getSubjectSummary: async (hallTicketNumber: string): Promise<any[]> => {
    const ht = hallTicketNumber.toUpperCase().trim();
    try {
      const student = await pgStudentRepository.findStudentById(ht);
      if (student && student.id) {
        const summary = await pgAttendanceRepository.getStudentSummary(Number(student.id));
        if (summary.overall.total > 0) {
          return summary.subjectWise;
        }
      }
    } catch (err) {
      logger.warn('PostgreSQL getSubjectSummary error, checking SQLite:', err);
    }

    try {
      const sdb = await getSqliteDB();
      const sql = `
        SELECT 
          s.id as subjectId,
          s.subjectCode,
          s.subjectName,
          COUNT(a.id) as total,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late
        FROM attendance a
        JOIN subjects s ON a.subjectId = s.id
        WHERE UPPER(a.hallTicketNumber) = ?
        GROUP BY s.id
      `;
      const rows = await sdb.all<any>(sql, [ht]);
      
      return rows.map((r: any) => {
        const presentWeight = r.present + (r.late * 0.5);
        const percentage = r.total > 0 ? Math.round((presentWeight / r.total) * 100) : null;
        return {
          ...r,
          percentage,
        };
      });
    } catch {
      return [];
    }
  },

  getSectionChecklist: async (subjectId: number, section: string, date: string): Promise<any[]> => {
    try {
      const sdb = await getSqliteDB();
      const students = await sdb.all<any>(
        'SELECT hallTicketNumber, name FROM students WHERE section = ? AND isActive = 1 ORDER BY hallTicketNumber ASC',
        [section]
      );

      const checklist: any[] = [];
      for (const s of students) {
        const att = await sdb.get<IAttendance>(
          'SELECT status FROM attendance WHERE UPPER(hallTicketNumber) = ? AND subjectId = ? AND date = ?',
          [s.hallTicketNumber.toUpperCase(), subjectId, date]
        );
        checklist.push({
          hallTicketNumber: s.hallTicketNumber,
          name: s.name,
          status: att?.status || 'present',
        });
      }

      return checklist;
    } catch {
      return [];
    }
  },

  // Attendance lock mechanism
  isLocked: async (subjectId: number, date: string, section: string): Promise<boolean> => {
    try {
      // 1. Check PostgreSQL attendance_sessions
      const res = await query(
        `SELECT sess.is_locked 
         FROM attendance_sessions sess
         LEFT JOIN sections sec ON sess.section_id = sec.id
         WHERE sess.subject_id = $1 AND sess.session_date = $2 
           AND (UPPER(sec.section_name) = UPPER($3) OR sess.section_id::text = $3)
         LIMIT 1`,
        [subjectId, date, String(section).trim()]
      );
      if (res.rows.length > 0) {
        return Boolean(res.rows[0].is_locked);
      }
    } catch (err) {
      logger.warn('PostgreSQL isLocked check error, falling back to SQLite:', err);
    }

    try {
      // 2. Check legacy SQLite
      const sdb = await getSqliteDB();
      const lock = await sdb.get<IAttendanceLock>(
        'SELECT locked FROM attendance_locks WHERE subjectId = ? AND date = ? AND section = ?',
        [subjectId, date, section]
      );
      return lock ? lock.locked === 1 : false;
    } catch {
      return false;
    }
  },

  lock: async (subjectId: number, date: string, section: string, lockedBy: number): Promise<void> => {
    try {
      // 1. Lock in PostgreSQL attendance_sessions
      await query(
        `UPDATE attendance_sessions sess
         SET is_locked = TRUE, locked_at = CURRENT_TIMESTAMP, locked_by = $4, updated_at = CURRENT_TIMESTAMP
         FROM sections sec
         WHERE sess.section_id = sec.id
           AND sess.subject_id = $1 AND sess.session_date = $2 
           AND (UPPER(sec.section_name) = UPPER($3) OR sess.section_id::text = $3)`,
        [subjectId, date, String(section).trim(), lockedBy]
      );
    } catch (err) {
      logger.warn('PostgreSQL lock error, falling back to SQLite:', err);
    }

    try {
      // 2. Lock in legacy SQLite
      const sdb = await getSqliteDB();
      await sdb.run(
        `INSERT OR REPLACE INTO attendance_locks (subjectId, date, section, locked, lockedBy, updatedAt)
         VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
        [subjectId, date, section, lockedBy]
      );
    } catch (err) {
      logger.warn('SQLite lock error:', err);
    }
  },

  unlock: async (subjectId: number, date: string, section: string): Promise<void> => {
    try {
      // 1. Unlock in PostgreSQL attendance_sessions
      await query(
        `UPDATE attendance_sessions sess
         SET is_locked = FALSE, locked_at = NULL, locked_by = NULL, updated_at = CURRENT_TIMESTAMP
         FROM sections sec
         WHERE sess.section_id = sec.id
           AND sess.subject_id = $1 AND sess.session_date = $2 
           AND (UPPER(sec.section_name) = UPPER($3) OR sess.section_id::text = $3)`,
        [subjectId, date, String(section).trim()]
      );
    } catch (err) {
      logger.warn('PostgreSQL unlock error, falling back to SQLite:', err);
    }

    try {
      // 2. Unlock in legacy SQLite
      const sdb = await getSqliteDB();
      await sdb.run(
        'UPDATE attendance_locks SET locked = 0, updatedAt = CURRENT_TIMESTAMP WHERE subjectId = ? AND date = ? AND section = ?',
        [subjectId, date, section]
      );
    } catch (err) {
      logger.warn('SQLite unlock error:', err);
    }
  },
};
