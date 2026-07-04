import * as db from '../config/database';
import { IAttendance, IAttendanceLock } from '../interfaces/db.interface';

export const attendanceRepository = {
  create: async (att: IAttendance): Promise<number> => {
    const res = await db.run(
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
  },

  upsert: async (att: IAttendance): Promise<void> => {
    const existing = await db.get<IAttendance>(
      'SELECT id FROM attendance WHERE UPPER(hallTicketNumber) = ? AND subjectId = ? AND date = ?',
      [att.hallTicketNumber.toUpperCase().trim(), att.subjectId, att.date]
    );

    if (existing && existing.id) {
      await db.run('UPDATE attendance SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [
        att.status,
        existing.id,
      ]);
    } else {
      await attendanceRepository.create(att);
    }
  },

  getStudentHistory: async (hallTicketNumber: string): Promise<IAttendance[]> => {
    return db.all<IAttendance>(
      `SELECT a.*, s.subjectCode, s.subjectName 
       FROM attendance a
       JOIN subjects s ON a.subjectId = s.id
       WHERE UPPER(a.hallTicketNumber) = ?
       ORDER BY a.date DESC`,
      [hallTicketNumber.toUpperCase().trim()]
    );
  },

  getSubjectSummary: async (hallTicketNumber: string): Promise<any[]> => {
    const ht = hallTicketNumber.toUpperCase().trim();
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
    const rows = await db.all<any>(sql, [ht]);
    
    return rows.map((r) => {
      const presentWeight = r.present + (r.late * 0.5); // Late is counted as half present
      const percentage = r.total > 0 ? Math.round((presentWeight / r.total) * 100) : 0;
      return {
        ...r,
        percentage,
      };
    });
  },

  getSectionChecklist: async (subjectId: number, section: string, date: string): Promise<any[]> => {
    // Get all active students in section
    const students = await db.all<any>(
      'SELECT hallTicketNumber, name FROM students WHERE section = ? AND isActive = 1 ORDER BY hallTicketNumber ASC',
      [section]
    );

    const checklist: any[] = [];
    for (const s of students) {
      const att = await db.get<IAttendance>(
        'SELECT status FROM attendance WHERE UPPER(hallTicketNumber) = ? AND subjectId = ? AND date = ?',
        [s.hallTicketNumber.toUpperCase(), subjectId, date]
      );
      checklist.push({
        hallTicketNumber: s.hallTicketNumber,
        name: s.name,
        status: att?.status || 'present', // Default to present
      });
    }

    return checklist;
  },

  // Attendance lock mechanism
  isLocked: async (subjectId: number, date: string, section: string): Promise<boolean> => {
    const lock = await db.get<IAttendanceLock>(
      'SELECT locked FROM attendance_locks WHERE subjectId = ? AND date = ? AND section = ?',
      [subjectId, date, section]
    );
    return lock ? lock.locked === 1 : false; // Defaults to false (unlocked)
  },

  lock: async (subjectId: number, date: string, section: string, lockedBy: number): Promise<void> => {
    await db.run(
      `INSERT OR REPLACE INTO attendance_locks (subjectId, date, section, locked, lockedBy, updatedAt)
       VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
      [subjectId, date, section, lockedBy]
    );
  },

  unlock: async (subjectId: number, date: string, section: string): Promise<void> => {
    await db.run(
      'UPDATE attendance_locks SET locked = 0, updatedAt = CURRENT_TIMESTAMP WHERE subjectId = ? AND date = ? AND section = ?',
      [subjectId, date, section]
    );
  },
};
