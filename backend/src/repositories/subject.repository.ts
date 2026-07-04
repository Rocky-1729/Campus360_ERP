import * as db from '../config/database';
import { ISubject } from '../interfaces/db.interface';

export const subjectRepository = {
  create: async (sub: Omit<ISubject, 'id'>): Promise<number> => {
    const res = await db.run(
      'INSERT INTO subjects (subjectCode, subjectName, department, semester, credits, isActive) VALUES (?, ?, ?, ?, ?, ?)',
      [
        sub.subjectCode.toUpperCase().trim(),
        sub.subjectName,
        sub.department ?? 'CSE',
        sub.semester,
        sub.credits ?? 4,
        sub.isActive ?? 1,
      ]
    );
    return res.lastID!;
  },

  findById: async (id: number): Promise<ISubject | undefined> => {
    return db.get<ISubject>('SELECT * FROM subjects WHERE id = ? AND isActive = 1', [id]);
  },

  findByCode: async (subjectCode: string): Promise<ISubject | undefined> => {
    return db.get<ISubject>('SELECT * FROM subjects WHERE UPPER(subjectCode) = ? AND isActive = 1', [
      subjectCode.toUpperCase().trim(),
    ]);
  },

  findAll: async (params?: { semester?: string }): Promise<ISubject[]> => {
    let sql = 'SELECT * FROM subjects WHERE isActive = 1';
    const queryParams: any[] = [];
    if (params?.semester) {
      sql += ' AND semester = ?';
      queryParams.push(params.semester);
    }
    sql += ' ORDER BY semester ASC, subjectCode ASC';
    return db.all<ISubject>(sql, queryParams);
  },

  update: async (id: number, sub: Partial<ISubject>): Promise<void> => {
    const fields: string[] = [];
    const params: any[] = [];

    const keys: (keyof ISubject)[] = ['subjectCode', 'subjectName', 'department', 'semester', 'credits', 'isActive'];
    keys.forEach((key) => {
      if (sub[key] !== undefined) {
        fields.push(`${String(key)} = ?`);
        params.push(sub[key]);
      }
    });

    if (fields.length === 0) return;

    fields.push('updatedAt = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  softDelete: async (id: number): Promise<void> => {
    await db.run('UPDATE subjects SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  },
};
