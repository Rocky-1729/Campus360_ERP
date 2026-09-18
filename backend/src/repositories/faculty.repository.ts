import * as db from '../config/database';
import { getSqliteDB } from '../config/sqliteDatabase';
import { IFaculty, IFacultyAssignment } from '../interfaces/db.interface';

export const facultyRepository = {
  findById: async (id: number): Promise<IFaculty | undefined> => {
    try {
      return await db.get<IFaculty>('SELECT * FROM faculty WHERE id = ? AND isActive = 1', [id]);
    } catch {
      const sdb = await getSqliteDB();
      return sdb.get<IFaculty>('SELECT * FROM faculty WHERE id = ? AND isActive = 1', [id]);
    }
  },

  findByFacultyId: async (facultyId: string): Promise<IFaculty | undefined> => {
    try {
      return await db.get<IFaculty>('SELECT * FROM faculty WHERE facultyId = ? AND isActive = 1', [
        facultyId.trim(),
      ]);
    } catch {
      const sdb = await getSqliteDB();
      return sdb.get<IFaculty>('SELECT * FROM faculty WHERE facultyId = ? AND isActive = 1', [
        facultyId.trim(),
      ]);
    }
  },

  findByUserId: async (userId: number): Promise<IFaculty | undefined> => {
    try {
      return await db.get<IFaculty>('SELECT * FROM faculty WHERE userId = ? AND isActive = 1', [userId]);
    } catch {
      const sdb = await getSqliteDB();
      return sdb.get<IFaculty>('SELECT * FROM faculty WHERE userId = ? AND isActive = 1', [userId]);
    }
  },

  create: async (faculty: IFaculty): Promise<number> => {
    const res = await db.run(
      `INSERT INTO faculty (
        userId, facultyId, name, email, phone, designation, qualification, isActive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        faculty.userId,
        faculty.facultyId.trim(),
        faculty.name,
        faculty.email.toLowerCase().trim(),
        faculty.phone ?? '',
        faculty.designation ?? '',
        faculty.qualification ?? '',
        faculty.isActive ?? 1,
      ]
    );
    return res.lastID!;
  },

  update: async (id: number, faculty: Partial<IFaculty>): Promise<void> => {
    const fields: string[] = [];
    const params: any[] = [];

    const keys: (keyof IFaculty)[] = [
      'name',
      'email',
      'phone',
      'designation',
      'qualification',
      'isActive',
    ];

    keys.forEach((key) => {
      if (faculty[key] !== undefined) {
        fields.push(`${String(key)} = ?`);
        params.push(faculty[key]);
      }
    });

    if (fields.length === 0) return;

    fields.push('updatedAt = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(`UPDATE faculty SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  softDelete: async (id: number): Promise<void> => {
    // Also deactivate the user credential
    const fac = await facultyRepository.findById(id);
    if (fac && fac.userId) {
      await db.run('UPDATE users SET isActive = 0 WHERE id = ?', [fac.userId]);
    }
    await db.run('UPDATE faculty SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [
      id,
    ]);
  },

  getAllFaculty: async (): Promise<IFaculty[]> => {
    return db.all<IFaculty>('SELECT * FROM faculty WHERE isActive = 1 ORDER BY name ASC');
  },

  // Faculty Assignments mapping
  getAssignments: async (params?: { facultyId?: number }): Promise<IFacultyAssignment[]> => {
    let sql = `
      SELECT fa.*, f.name as facultyName, f.facultyId as facultyCode, s.subjectCode, s.subjectName
      FROM faculty_assignments fa
      JOIN faculty f ON fa.facultyId = f.id
      JOIN subjects s ON fa.subjectId = s.id
    `;
    const queryParams: any[] = [];
    if (params?.facultyId) {
      sql += ' WHERE fa.facultyId = ?';
      queryParams.push(params.facultyId);
    }
    sql += ' ORDER BY s.semester ASC, fa.section ASC';
    return db.all<IFacultyAssignment>(sql, queryParams);
  },

  createAssignment: async (assignment: {
    facultyId: number;
    subjectId: number;
    section: string;
    semester: string;
  }): Promise<number> => {
    const res = await db.run(
      'INSERT INTO faculty_assignments (facultyId, subjectId, section, semester) VALUES (?, ?, ?, ?)',
      [assignment.facultyId, assignment.subjectId, assignment.section, assignment.semester]
    );
    return res.lastID!;
  },

  deleteAssignment: async (id: number): Promise<void> => {
    await db.run('DELETE FROM faculty_assignments WHERE id = ?', [id]);
  },
};
