import * as db from '../config/database';
import { IStudent } from '../interfaces/db.interface';

export const studentRepository = {
  findById: async (id: number): Promise<IStudent | undefined> => {
    return db.get<IStudent>('SELECT * FROM students WHERE id = ? AND isActive = 1', [id]);
  },

  findByHallTicket: async (hallTicketNumber: string): Promise<IStudent | undefined> => {
    return db.get<IStudent>(
      'SELECT * FROM students WHERE UPPER(hallTicketNumber) = ? AND isActive = 1',
      [hallTicketNumber.toUpperCase().trim()]
    );
  },

  findByUserId: async (userId: number): Promise<IStudent | undefined> => {
    return db.get<IStudent>('SELECT * FROM students WHERE userId = ? AND isActive = 1', [userId]);
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
    const student = await db.get<IStudent>('SELECT createdAt FROM students WHERE UPPER(hallTicketNumber) = ?', [ht]);
    if (student) {
      timeline.push({
        date: student.createdAt || new Date().toISOString(),
        type: 'admission',
        title: 'Joined Department',
        description: `Student profile officially registered in the CSE Department database.`,
      });
    }

    // 2. Marks Upload history
    const marksList = await db.all<any>(
      'SELECT DISTINCT semester, academicYear, createdAt FROM marks WHERE UPPER(hallTicketNumber) = ? ORDER BY createdAt ASC',
      [ht]
    );
    marksList.forEach((m) => {
      timeline.push({
        date: m.createdAt,
        type: 'academic',
        title: `Semester ${m.semester} Results Uploaded`,
        description: `Official marks sheet for Semester ${m.semester} (A.Y. ${m.academicYear}) uploaded by HOD.`,
      });
    });

    // 3. Certificates uploaded
    const certs = await db.all<any>(
      'SELECT title, type, status, createdAt FROM certificates WHERE UPPER(hallTicketNumber) = ? ORDER BY createdAt ASC',
      [ht]
    );
    certs.forEach((c) => {
      timeline.push({
        date: c.createdAt,
        type: 'certificate',
        title: `Certificate Uploaded: ${c.title}`,
        description: `Submitted proof for ${c.type}. Current status: ${c.status}.`,
        status: c.status,
      });
    });

    // 4. Achievements uploaded
    const achs = await db.all<any>(
      'SELECT title, category, status, createdAt FROM achievements WHERE UPPER(hallTicketNumber) = ? ORDER BY createdAt ASC',
      [ht]
    );
    achs.forEach((a) => {
      timeline.push({
        date: a.createdAt,
        type: 'achievement',
        title: `Achievement Logged: ${a.title}`,
        description: `Logged award win in ${a.category}. Verification state: ${a.status}.`,
        status: a.status,
      });
    });

    // Sort timeline chronologically (newest first)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return timeline;
  },
};
