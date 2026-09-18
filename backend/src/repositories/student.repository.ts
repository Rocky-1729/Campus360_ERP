import * as db from '../config/database';
import { getSqliteDB } from '../config/sqliteDatabase';
import { IStudent } from '../interfaces/db.interface';

export const studentRepository = {
  findById: async (id: number): Promise<IStudent | undefined> => {
    try {
      const pgRes = await db.query(`
        SELECT 
          s.id, 
          s.hall_ticket_number AS "hallTicketNumber", 
          s.full_name AS "name", 
          s.email, 
          s.phone_number AS "mobile", 
          s.gender,
          d.department_code AS "department",
          sec.section_name AS "section",
          1 AS "isActive"
        FROM students s
        LEFT JOIN student_academic_enrollments sae ON sae.student_id = s.id
        LEFT JOIN academic_batches b ON sae.academic_batch_id = b.id
        LEFT JOIN programs p ON b.program_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN sections sec ON sae.section_id = sec.id
        WHERE s.id = $1
        LIMIT 1;
      `, [id]);
      if (pgRes.rows.length > 0) {
        return pgRes.rows[0] as IStudent;
      }
    } catch {
      // Fallback
    }
    const sdb = await getSqliteDB();
    return sdb.get<IStudent>('SELECT * FROM students WHERE id = ? AND isActive = 1', [id]);
  },

  findByHallTicket: async (hallTicketNumber: string): Promise<IStudent | undefined> => {
    const ht = hallTicketNumber.toUpperCase().trim();
    try {
      const pgRes = await db.query(`
        SELECT 
          s.id, 
          s.hall_ticket_number AS "hallTicketNumber", 
          s.full_name AS "name", 
          s.email, 
          s.phone_number AS "mobile", 
          s.gender,
          d.department_code AS "department",
          sec.section_name AS "section",
          1 AS "isActive"
        FROM students s
        LEFT JOIN student_academic_enrollments sae ON sae.student_id = s.id
        LEFT JOIN academic_batches b ON sae.academic_batch_id = b.id
        LEFT JOIN programs p ON b.program_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN sections sec ON sae.section_id = sec.id
        WHERE UPPER(s.hall_ticket_number) = $1
        LIMIT 1;
      `, [ht]);
      if (pgRes.rows.length > 0) {
        return pgRes.rows[0] as IStudent;
      }
    } catch {
      // Fallback
    }
    try {
      const sdb = await getSqliteDB();
      return sdb.get<IStudent>(
        'SELECT * FROM students WHERE UPPER(hallTicketNumber) = ? AND isActive = 1',
        [ht]
      );
    } catch {
      return undefined;
    }
  },

  findByUserId: async (userId: number): Promise<IStudent | undefined> => {
    try {
      const pgRes = await db.query(`
        SELECT 
          s.id, 
          s.hall_ticket_number AS "hallTicketNumber", 
          s.full_name AS "name", 
          s.email, 
          s.phone_number AS "mobile", 
          s.gender,
          d.department_code AS "department",
          sec.section_name AS "section",
          1 AS "isActive"
        FROM users u
        JOIN students s ON (u.student_id = s.id OR UPPER(u.username) = UPPER(s.hall_ticket_number))
        LEFT JOIN student_academic_enrollments sae ON sae.student_id = s.id
        LEFT JOIN academic_batches b ON sae.academic_batch_id = b.id
        LEFT JOIN programs p ON b.program_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN sections sec ON sae.section_id = sec.id
        WHERE u.id = $1
        LIMIT 1;
      `, [userId]);
      if (pgRes.rows.length > 0) {
        return pgRes.rows[0] as IStudent;
      }
    } catch {
      // Fallback
    }
    try {
      const sdb = await getSqliteDB();
      return sdb.get<IStudent>('SELECT * FROM students WHERE userId = ? AND isActive = 1', [userId]);
    } catch {
      return undefined;
    }
  },

  create: async (student: IStudent): Promise<number> => {
    const res = await db.run(
      `INSERT INTO students (
        userId, hallTicketNumber, name, fatherName, motherName, email, mobile,
        dateOfBirth, gender, aadhaarNumber, abcId, department, year, section, isActive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student.userId,
        student.hallTicketNumber.toUpperCase().trim(),
        student.name,
        student.fatherName ?? '',
        student.motherName ?? '',
        student.email ?? '',
        student.mobile ?? '',
        student.dateOfBirth,
        student.gender,
        student.aadhaarNumber ?? '',
        student.abcId ?? '',
        student.department ?? 'CSE',
        student.year,
        student.section ?? '',
        student.isActive ?? 1,
      ]
    );
    return res.lastID!;
  },

  update: async (hallTicketNumber: string, student: Partial<IStudent>): Promise<void> => {
    const fields: string[] = [];
    const params: any[] = [];

    const keys: (keyof IStudent)[] = [
      'name',
      'fatherName',
      'motherName',
      'email',
      'mobile',
      'dateOfBirth',
      'gender',
      'aadhaarNumber',
      'abcId',
      'department',
      'year',
      'section',
      'isActive',
    ];

    keys.forEach((key) => {
      if (student[key] !== undefined) {
        fields.push(`${String(key)} = ?`);
        params.push(student[key]);
      }
    });

    if (fields.length === 0) return;

    fields.push('updatedAt = CURRENT_TIMESTAMP');
    params.push(hallTicketNumber.toUpperCase().trim());

    await db.run(`UPDATE students SET ${fields.join(', ')} WHERE UPPER(hallTicketNumber) = ?`, params);
  },

  softDelete: async (hallTicketNumber: string): Promise<void> => {
    // Deactivate user as well
    const student = await studentRepository.findByHallTicket(hallTicketNumber);
    if (student && student.userId) {
      await db.run('UPDATE users SET isActive = 0 WHERE id = ?', [student.userId]);
    }
    await db.run(
      'UPDATE students SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE UPPER(hallTicketNumber) = ?',
      [hallTicketNumber.toUpperCase().trim()]
    );
  },

  searchStudents: async (params: {
    query?: string;
    section?: string;
    year?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: IStudent[]; count: number }> => {
    let sql = 'SELECT * FROM students WHERE isActive = 1';
    let countSql = 'SELECT COUNT(*) as count FROM students WHERE isActive = 1';
    const queryParams: any[] = [];

    if (params.query) {
      const q = `%${params.query}%`;
      sql += ' AND (name LIKE ? OR hallTicketNumber LIKE ?)';
      countSql += ' AND (name LIKE ? OR hallTicketNumber LIKE ?)';
      queryParams.push(q, q);
    }
    if (params.section) {
      sql += ' AND section = ?';
      countSql += ' AND section = ?';
      queryParams.push(params.section);
    }
    if (params.year) {
      sql += ' AND year = ?';
      countSql += ' AND year = ?';
      queryParams.push(params.year);
    }

    const countRes = await db.get<{ count: number }>(countSql, queryParams);
    const count = countRes?.count || 0;

    sql += ' ORDER BY hallTicketNumber ASC';
    if (params.limit !== undefined && params.offset !== undefined) {
      sql += ' LIMIT ? OFFSET ?';
      queryParams.push(params.limit, params.offset);
    }

    const rows = await db.all<IStudent>(sql, queryParams);
    return { rows, count };
  },

  getTimeline: async (hallTicketNumber: string): Promise<Array<{
    date: string;
    type: string;
    title: string;
    description: string;
    status?: string;
  }>> => {
    const timeline: Array<{
      date: string;
      type: string;
      title: string;
      description: string;
      status?: string;
    }> = [];

    const ht = hallTicketNumber.toUpperCase().trim();

    // 1. Admission Date
    try {
      const pgRes = await db.query<{ created_at: string }>(
        'SELECT created_at FROM students WHERE UPPER(hall_ticket_number) = $1 LIMIT 1',
        [ht]
      );
      if (pgRes.rows.length > 0) {
        timeline.push({
          date: pgRes.rows[0].created_at || new Date().toISOString(),
          type: 'admission',
          title: 'Joined Department',
          description: 'Student profile officially registered in the academic database.',
        });
      }
    } catch {
      // safe fallback
    }

    try {
      const sdb = await getSqliteDB();

      // 2. Marks Upload history
      const marksList = await sdb.all<any>(
        'SELECT DISTINCT semester, academicYear, createdAt FROM marks WHERE UPPER(hallTicketNumber) = ? ORDER BY createdAt ASC',
        [ht]
      );
      marksList.forEach((m: any) => {
        timeline.push({
          date: m.createdAt,
          type: 'academic',
          title: `Semester ${m.semester} Results Uploaded`,
          description: `Official marks sheet for Semester ${m.semester} (A.Y. ${m.academicYear}) uploaded.`,
        });
      });

      // 3. Certificates uploaded
      const certs = await sdb.all<any>(
        'SELECT title, type, status, createdAt FROM certificates WHERE UPPER(hallTicketNumber) = ? ORDER BY createdAt ASC',
        [ht]
      );
      certs.forEach((c: any) => {
        timeline.push({
          date: c.createdAt,
          type: 'certificate',
          title: `Certificate Uploaded: ${c.title}`,
          description: `Submitted proof for ${c.type}. Current status: ${c.status}.`,
          status: c.status,
        });
      });

      // 4. Achievements uploaded
      const achs = await sdb.all<any>(
        'SELECT title, category, status, createdAt FROM achievements WHERE UPPER(hallTicketNumber) = ? ORDER BY createdAt ASC',
        [ht]
      );
      achs.forEach((a: any) => {
        timeline.push({
          date: a.createdAt,
          type: 'achievement',
          title: `Achievement Logged: ${a.title}`,
          description: `Logged award win in ${a.category}. Verification state: ${a.status}.`,
          status: a.status,
        });
      });
    } catch {
      // Legacy SQLite tables optional
    }

    // Sort timeline chronologically (newest first)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return timeline;
  },
};
